import { useEffect, useRef, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { usePlayer } from '@/contexts/PlayerContext';
import { Headphones, Users, Search, Radio, Clock, UserPlus, UserCheck, UserX } from 'lucide-react';
import type { Profile, Follow, Song } from '@/types/music';
import { useSeo } from '@/lib/useSeo';

interface FriendPresence {
  user: Profile;
  is_listening: boolean;
  current_song_id: string | null;
  current_song_title: string | null;
  current_song_author: string | null;
  current_song_cover_url: string | null;
  last_seen_at: string;
}

export default function Social() {
  useSeo({ title: 'Social — Jux-Music', description: 'Suis tes amis, découvre leurs écoutes en direct et leur activité musicale sur Jux-Music.', path: '/social' });

  const { user } = useAuth();
  const navigate = useNavigate();
  const { playSongFromList } = usePlayer();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<(Follow & { profile?: Profile })[]>([]);
  const [presences, setPresences] = useState<Map<string, FriendPresence>>(new Map());
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState('friends');
  const initialLoadDone = useRef(false);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  const fetchProfiles = async (ids: string[]) => {
    if (!ids.length) return [] as Profile[];
    const result: Profile[] = [];
    for (const uid of ids) {
      try {
        const r = await pbGetFirst('profiles', `user_id = "${uid}"`);
        if (r) result.push({ id: r.id, user_id: r.user_id, pseudo: r.pseudo, first_name: r.first_name, last_name: r.last_name, avatar: r.avatar ?? null, avatar_url: r.avatar_url ?? null, bio: r.bio, profile_completed: r.profile_completed, collectionName: r.collectionName, collectionId: r.collectionId, created_at: r.created, updated_at: r.updated } as Profile);
      } catch {}
    }
    return result;
  };

  const load = async () => {
    if (!user) return;

    const [outF, inF, req] = await Promise.all([
      pb.collection('follows').getList(1, 200, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      pb.collection('follows').getList(1, 200, { filter: `following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      pb.collection('follows').getList(1, 200, { filter: `following_id = "${user.id}" && status = "pending"`, requestKey: null }),
    ]);

    const followingIds = outF.items.map((f: any) => f.following_id);
    const followingProfiles = await fetchProfiles(followingIds);
    setFollowing(followingProfiles);

    // Own profile + presence
    const myP = await pbGetFirst('profiles', `user_id = "${user.id}"`);
    if (myP) {
      const p = { id: myP.id, user_id: myP.user_id, pseudo: myP.pseudo, first_name: myP.first_name, last_name: myP.last_name, avatar: myP.avatar ?? null, avatar_url: myP.avatar_url ?? null, bio: myP.bio, profile_completed: myP.profile_completed, collectionName: myP.collectionName, collectionId: myP.collectionId, created_at: myP.created, updated_at: myP.updated } as Profile;
      setMyProfile(p);
      const myPres = await pbGetFirst('user_presence', `user_id = "${user.id}"`);
      if (myPres) {
        setPresences((prev) => { const next = new Map(prev); next.set(user.id, { user: p, is_listening: myPres.is_listening, current_song_id: myPres.current_song_id, current_song_title: myPres.current_song_title, current_song_author: myPres.current_song_author, current_song_cover_url: myPres.current_song_cover_url, last_seen_at: myPres.last_seen_at }); return next; });
      }
    }

    const followerIds = inF.items.map((f: any) => f.follower_id);
    setFollowers(await fetchProfiles(followerIds));

    const reqItems = req.items.map((r: any) => ({ id: r.id, follower_id: r.follower_id, following_id: r.following_id, status: r.status, created_at: r.created } as Follow));
    const reqProfiles = await fetchProfiles(reqItems.map((r) => r.follower_id));
    setRequests(reqItems.map((r) => ({ ...r, profile: reqProfiles.find((p) => p.user_id === r.follower_id) })));

    // Load presences
    if (followingIds.length > 0) {
      const map = new Map<string, FriendPresence>();
      for (const uid of followingIds) {
        try {
          const pr = await pbGetFirst('user_presence', `user_id = "${uid}"`);
          if (pr) {
            const profile = followingProfiles.find((fp) => fp.user_id === uid);
            if (profile) map.set(uid, { user: profile, is_listening: pr.is_listening, current_song_id: pr.current_song_id, current_song_title: pr.current_song_title, current_song_author: pr.current_song_author, current_song_cover_url: pr.current_song_cover_url, last_seen_at: pr.last_seen_at });
          }
        } catch {}
      }
      setPresences((prev) => { const next = new Map(prev); for (const [k, v] of map) next.set(k, v); return next; });
    }
    initialLoadDone.current = true;
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Polling for presences
  useEffect(() => {
    if (!user || following.length === 0) return;
    const doPoll = async () => {
      const friendIds = following.map((f) => f.user_id);
      for (const uid of friendIds) {
        try {
          const pr = await pbGetFirst('user_presence', `user_id = "${uid}"`);
          if (pr) {
            setPresences((prev) => {
              const next = new Map(prev);
              const existing = next.get(uid);
              if (existing) next.set(uid, { ...existing, is_listening: pr.is_listening, current_song_id: pr.current_song_id, current_song_title: pr.current_song_title, current_song_author: pr.current_song_author, current_song_cover_url: pr.current_song_cover_url, last_seen_at: pr.last_seen_at });
              return next;
            });
          }
        } catch {}
      }
    };
    const interval = setInterval(doPoll, 3000);
    if (initialLoadDone.current) doPoll();
    return () => clearInterval(interval);
  }, [user, following]);

  const accept = async (id: string) => {
    try { await pb.collection('follows').update(id, { status: 'accepted' }); toast.success('Demande acceptée'); load(); } catch {}
  };
  const reject = async (id: string) => {
    try { await pb.collection('follows').delete(id); load(); } catch {}
  };

  const sortedFollowing = [...following].sort((a, b) => {
    const pa = presences.get(a.user_id); const pb = presences.get(b.user_id);
    if (pa?.is_listening && !pb?.is_listening) return -1;
    if (!pa?.is_listening && pb?.is_listening) return 1;
    return 0;
  });

  const [discoverTerm, setDiscoverTerm] = useState('');
  const [discoverResults, setDiscoverResults] = useState<Profile[]>([]);
  const [followStatuses, setFollowStatuses] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});

  const searchDiscover = useCallback(async (term: string) => {
    if (!term.trim() || !user) return;
    try {
      const res = await pb.collection('profiles').getList(1, 30, {
        filter: `pseudo ~ "${term.trim()}" && user_id != "${user.id}"`,
        requestKey: null,
      });
      const profiles = res.items.map((r: any) => ({
        id: r.id, user_id: r.user_id, pseudo: r.pseudo,
        first_name: r.first_name, last_name: r.last_name,
        avatar: r.avatar ?? null, avatar_url: r.avatar_url ?? null, bio: r.bio,
        profile_completed: r.profile_completed, collectionName: r.collectionName, collectionId: r.collectionId,
        created_at: r.created, updated_at: r.updated,
      } as Profile));
      setDiscoverResults(profiles);

      const statuses: Record<string, 'none' | 'pending' | 'accepted'> = {};
      for (const p of profiles) {
        try {
          const fRes = await pb.collection('follows').getList(1, 1, {
            filter: `follower_id = "${user.id}" && following_id = "${p.user_id}"`,
            requestKey: null,
          });
          if (fRes.items.length > 0) {
            statuses[p.user_id] = fRes.items[0].status as 'pending' | 'accepted';
          } else {
            statuses[p.user_id] = 'none';
          }
        } catch { statuses[p.user_id] = 'none'; }
      }
      setFollowStatuses(statuses);
    } catch {}
  }, [user]);

  const followUser = async (targetUserId: string) => {
    if (!user) return;
    try {
      await pb.collection('follows').create({ follower_id: user.id, following_id: targetUserId, status: 'pending' });
      setFollowStatuses((s) => ({ ...s, [targetUserId]: 'pending' }));
      toast.success('Demande envoyée');
    } catch (e: any) { toast.error(e.message); }
  };

  const unfollowUser = async (targetUserId: string) => {
    if (!user) return;
    try {
      const res = await pb.collection('follows').getList(1, 1, {
        filter: `follower_id = "${user.id}" && following_id = "${targetUserId}"`,
        requestKey: null,
      });
      if (res.items[0]) await pb.collection('follows').delete(res.items[0].id);
      setFollowStatuses((s) => ({ ...s, [targetUserId]: 'none' }));
      toast.success('Abonnement retiré');
    } catch {}
  };

  const isPresenceFresh = (p: FriendPresence) =>
    p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 10_000;

  const maxInitial = 20;
  const [showAll, setShowAll] = useState(false);
  const displayedFollowing = showAll ? sortedFollowing : sortedFollowing.slice(0, maxInitial);
  const hasMore = sortedFollowing.length > maxInitial;

  return (
    <div className="relative min-h-screen pb-40">
      <Tabs value={tab} onValueChange={setTab} className="px-4 pt-4">
        <TabsList className="mb-4">
          <TabsTrigger value="friends"><Users className="h-4 w-4 mr-1" />Amis</TabsTrigger>
          <TabsTrigger value="discover"><Search className="h-4 w-4 mr-1" />Découvrir</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {requests.length > 0 && (
            <div className="rounded-xl bg-card/50 p-4">
              <h2 className="font-bold mb-3">Demandes en attente ({requests.length})</h2>
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <Avatar className="h-10 w-10"><AvatarImage src={avatarUrl(r.profile as any) || ''} /><AvatarFallback>{r.profile?.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                    <span className="flex-1 text-sm">{r.profile?.pseudo || 'Anonyme'}</span>
                    <Button size="sm" onClick={() => accept(r.id)}>Accepter</Button>
                    <Button size="sm" variant="ghost" onClick={() => reject(r.id)}>Refuser</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section "En ce moment" */}
          {(() => {
            const nowPlaying = [...presences.values()].filter((p) => p.is_listening && p.current_song_title && isPresenceFresh(p));
            if (nowPlaying.length === 0) return null;
            return (
              <div>
                <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  En ce moment
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
                  {nowPlaying.map((p) => (
                    <button
                      key={p.user.user_id}
                      onClick={() => navigate(`/u/${p.user.user_id}`)}
                      className="relative flex-shrink-0 w-36 rounded-2xl overflow-hidden aspect-square shadow-lg"
                    >
                      {/* Cover background */}
                      {p.current_song_cover_url
                        ? <img src={p.current_song_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        : <div className="absolute inset-0 bg-secondary" />}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {/* Avatar */}
                      <div className="absolute top-2 left-2">
                        <div className="relative">
                          <Avatar className="h-8 w-8 ring-2 ring-white/30">
                            <AvatarImage src={avatarUrl(p.user as any)} />
                            <AvatarFallback className="text-xs">{p.user.pseudo?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border border-black" />
                        </div>
                      </div>
                      {/* Song info */}
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[11px] font-bold text-white truncate leading-tight">{p.current_song_title}</p>
                        <p className="text-[10px] text-white/70 truncate">{p.current_song_author}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <h2 className="font-bold text-lg">Amis</h2>
          {sortedFollowing.length === 0 ? (
            <div className="rounded-xl bg-card/50 p-8 text-center"><Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-muted-foreground">Tu ne suis personne encore</p><Button variant="outline" className="mt-3" onClick={() => navigate('/search')}>Rechercher des amis</Button></div>
          ) : (
            <div className="space-y-2">
              {displayedFollowing.map((f) => {
                const presence = presences.get(f.user_id);
                return (
                  <div key={f.user_id} onClick={() => navigate(`/u/${f.user_id}`)} className="flex items-center gap-3 rounded-xl bg-card/50 p-3 cursor-pointer hover:bg-card">
                    <div className="relative">
                      <Avatar className="h-12 w-12"><AvatarImage src={avatarUrl(f as any)} /><AvatarFallback>{f.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                      {presence?.is_listening && isPresenceFresh(presence) && <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{f.pseudo || 'Anonyme'}</p>
                      {presence?.is_listening && isPresenceFresh(presence) && presence.current_song_title ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Headphones className="h-3 w-3 text-green-500" />{presence.current_song_title}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{presence?.last_seen_at ? 'Hors ligne' : 'Hors ligne'}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && !showAll && <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>Voir tout ({sortedFollowing.length})</Button>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Chercher un utilisateur..."
              value={discoverTerm}
              onChange={(e) => setDiscoverTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchDiscover(discoverTerm)}
            />
            <Button size="icon" onClick={() => searchDiscover(discoverTerm)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {discoverResults.length === 0 && discoverTerm.trim() === '' && (
            <div className="flex flex-col items-center mt-12 text-muted-foreground gap-2">
              <Users className="h-10 w-10" />
              <p className="text-sm">Recherche des utilisateurs à suivre</p>
            </div>
          )}
          {discoverResults.length === 0 && discoverTerm.trim() !== '' && (
            <p className="text-center text-muted-foreground mt-8 text-sm">Aucun résultat pour "{discoverTerm}"</p>
          )}
          <div className="space-y-2">
            {discoverResults.map((p) => {
              const status = followStatuses[p.user_id] ?? 'none';
              return (
                <div key={p.user_id} className="flex items-center gap-3 rounded-xl bg-card/50 p-3">
                  <Avatar className="h-11 w-11 cursor-pointer" onClick={() => navigate(`/u/${p.user_id}`)}>
                    <AvatarImage src={p.avatar_url || ''} />
                    <AvatarFallback>{p.pseudo?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/u/${p.user_id}`)}>
                    <p className="font-semibold text-sm truncate">{p.pseudo || 'Anonyme'}</p>
                    {p.bio && <p className="text-xs text-muted-foreground truncate">{p.bio}</p>}
                  </div>
                  {status === 'none' && (
                    <Button size="sm" onClick={() => followUser(p.user_id)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Suivre
                    </Button>
                  )}
                  {status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => unfollowUser(p.user_id)}>
                      <Clock className="h-3.5 w-3.5 mr-1" /> En attente
                    </Button>
                  )}
                  {status === 'accepted' && (
                    <Button size="sm" variant="secondary" onClick={() => unfollowUser(p.user_id)}>
                      <UserCheck className="h-3.5 w-3.5 mr-1" /> Suivi
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}