import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { usePlayer } from '@/contexts/PlayerContext';
import { Headphones, Users, Search, Radio, Clock } from 'lucide-react';
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
        if (r) result.push({ id: r.id, user_id: r.get('user_id'), pseudo: r.get('pseudo'), first_name: r.get('first_name'), last_name: r.get('last_name'), avatar_url: r.get('avatar'), bio: r.get('bio'), profile_completed: r.get('profile_completed'), created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated } as Profile);
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

    const followingIds = outF.items.map((f: any) => f.get('following_id'));
    const followingProfiles = await fetchProfiles(followingIds);
    setFollowing(followingProfiles);

    // Own profile + presence
    const myP = await pbGetFirst('profiles', `user_id = "${user.id}"`);
    if (myP) {
      const p = { id: myP.id, user_id: myP.get('user_id'), pseudo: myP.get('pseudo'), first_name: myP.get('first_name'), last_name: myP.get('last_name'), avatar_url: myP.get('avatar'), bio: myP.get('bio'), profile_completed: myP.get('profile_completed'), created_at: myP.get('created') || myP.created, updated_at: myP.get('updated') || myP.updated } as Profile;
      setMyProfile(p);
      const myPres = await pbGetFirst('user_presence', `user_id = "${user.id}"`);
      if (myPres) {
        setPresences((prev) => { const next = new Map(prev); next.set(user.id, { user: p, is_listening: myPres.get('is_listening'), current_song_id: myPres.get('current_song_id'), current_song_title: myPres.get('current_song_title'), current_song_author: myPres.get('current_song_author'), current_song_cover_url: myPres.get('current_song_cover_url'), last_seen_at: myPres.get('last_seen_at') }); return next; });
      }
    }

    const followerIds = inF.items.map((f: any) => f.get('follower_id'));
    setFollowers(await fetchProfiles(followerIds));

    const reqItems = req.items.map((r: any) => ({ id: r.id, follower_id: r.get('follower_id'), following_id: r.get('following_id'), status: r.get('status'), created_at: r.get('created') } as Follow));
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
            if (profile) map.set(uid, { user: profile, is_listening: pr.get('is_listening'), current_song_id: pr.get('current_song_id'), current_song_title: pr.get('current_song_title'), current_song_author: pr.get('current_song_author'), current_song_cover_url: pr.get('current_song_cover_url'), last_seen_at: pr.get('last_seen_at') });
          }
        } catch {}
      }
      setPresences(map);
    }
    initialLoadDone.current = true;
  };

  useEffect(() => { load(); }, [user]);

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
              if (existing) next.set(uid, { ...existing, is_listening: pr.get('is_listening'), current_song_id: pr.get('current_song_id'), current_song_title: pr.get('current_song_title'), current_song_author: pr.get('current_song_author'), current_song_cover_url: pr.get('current_song_cover_url'), last_seen_at: pr.get('last_seen_at') });
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
                    <Avatar className="h-10 w-10"><AvatarImage src={r.profile?.avatar_url || ''} /><AvatarFallback>{r.profile?.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                    <span className="flex-1 text-sm">{r.profile?.pseudo || 'Anonyme'}</span>
                    <Button size="sm" onClick={() => accept(r.id)}>Accepter</Button>
                    <Button size="sm" variant="ghost" onClick={() => reject(r.id)}>Refuser</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="font-bold text-lg">Amis en ligne</h2>
          {sortedFollowing.length === 0 ? (
            <div className="rounded-xl bg-card/50 p-8 text-center"><Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-muted-foreground">Tu ne suis personne encore</p><Button variant="outline" className="mt-3" onClick={() => navigate('/search')}>Rechercher des amis</Button></div>
          ) : (
            <div className="space-y-2">
              {displayedFollowing.map((f) => {
                const presence = presences.get(f.user_id);
                return (
                  <div key={f.user_id} onClick={() => navigate(`/user/${f.user_id}`)} className="flex items-center gap-3 rounded-xl bg-card/50 p-3 cursor-pointer hover:bg-card">
                    <div className="relative">
                      <Avatar className="h-12 w-12"><AvatarImage src={f.avatar_url || ''} /><AvatarFallback>{f.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                      {presence?.is_listening && <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{f.pseudo || 'Anonyme'}</p>
                      {presence?.is_listening && presence.current_song_title ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Headphones className="h-3 w-3 text-green-500" />{presence.current_song_title}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{presence ? 'En ligne' : 'Hors ligne'}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && !showAll && <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>Voir tout ({sortedFollowing.length})</Button>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover">
          <p className="text-center text-muted-foreground mt-8">Fonctionnalité à venir...</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}