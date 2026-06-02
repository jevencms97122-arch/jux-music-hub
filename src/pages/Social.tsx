import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
}

const _SOCIAL_SEO_MARK = true;
  last_seen_at: string;
}

export default function Social() {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const { playSongFromList } = usePlayer();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<(Follow & { profile?: Profile })[]>([]);
  const [presences, setPresences] = useState<Map<string, FriendPresence>>(new Map());
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState('friends');
  const initialLoadDone = useRef(false);

  const load = async () => {
    if (!authUser) return;

    const { data: outF } = await supabase
      .from('follows').select('*').eq('follower_id', authUser.id).eq('status', 'accepted');
    const { data: inF } = await supabase
      .from('follows').select('*').eq('following_id', authUser.id).eq('status', 'accepted');
    const { data: req } = await supabase
      .from('follows').select('*').eq('following_id', authUser.id).eq('status', 'pending');

    const fetchProfiles = async (ids: string[]) => {
      if (!ids.length) return [] as Profile[];
      const { data } = await supabase.from('profiles').select('*').in('user_id', ids);
      return (data ?? []) as Profile[];
    };

    const followingIds = (outF ?? []).map((f) => f.following_id);
    const followingProfiles = await fetchProfiles(followingIds);
    setFollowing(followingProfiles);

    // Récupérer son propre profil et sa présence
    const { data: myP } = await supabase.from('profiles').select('*').eq('user_id', authUser.id).maybeSingle();
    if (myP) {
      setMyProfile(myP as Profile);
      const { data: myPres } = await (supabase as any).from('user_presence').select('*').eq('user_id', authUser.id).maybeSingle();
      if (myPres) {
        setPresences((prev) => {
          const next = new Map(prev);
          next.set(authUser.id, { user: myP as Profile, ...myPres });
          return next;
        });
      }
    }
    setFollowers(await fetchProfiles((inF ?? []).map((f) => f.follower_id)));
    const reqProfiles = await fetchProfiles((req ?? []).map((r) => r.follower_id));
    setRequests((req ?? []).map((r) => ({
      ...(r as Follow),
      profile: reqProfiles.find((p) => p.user_id === r.follower_id),
    })));

    // Charger les présences des amis
    if (followingIds.length > 0) {
      const { data: presenceData } = await (supabase as any)
        .from('user_presence')
        .select('*')
        .in('user_id', followingIds);
      const map = new Map<string, FriendPresence>();
      (presenceData ?? []).forEach((p: any) => {
        const profile = followingProfiles.find((fp) => fp.user_id === p.user_id);
        if (profile) {
          map.set(p.user_id, { user: profile, ...p });
        }
      });
      setPresences(map);
    }
    initialLoadDone.current = true;
  };

  useEffect(() => { load(); }, [authUser]);

  // Realtime : mises à jour des présences
  useEffect(() => {
    if (!authUser || following.length === 0) return;
    const friendIds = following.map((f) => f.user_id);
    const channel = supabase
      .channel('social-presences')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, (payload: any) => {
        const p = payload.new;
        if (!p || !friendIds.includes(p.user_id)) return;
        setPresences((prev) => {
          const next = new Map(prev);
          const existing = next.get(p.user_id);
          if (existing) {
            next.set(p.user_id, { ...existing, ...p });
          }
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser, following]);

  // Polling très rapide toutes les 3s : recharge les présences
  useEffect(() => {
    if (!authUser) return;
    const doPoll = async () => {
      if (following.length === 0) return;
      const friendIds = following.map((f) => f.user_id);
      const { data: presenceData } = await (supabase as any)
        .from('user_presence')
        .select('*')
        .in('user_id', friendIds);
      if (!presenceData) return;
      setPresences((prev) => {
        const next = new Map(prev);
        (presenceData as any[]).forEach((p: any) => {
          const existing = next.get(p.user_id);
          if (existing) {
            next.set(p.user_id, { ...existing, ...p });
          } else {
            const profile = following.find((fp) => fp.user_id === p.user_id);
            if (profile) {
              next.set(p.user_id, { user: profile, ...p });
            }
          }
        });
        return next;
      });
    };
    const interval = setInterval(doPoll, 3000);
    // Premier appel immédiat si le load initial a déjà eu lieu
    if (initialLoadDone.current) doPoll();
    return () => clearInterval(interval);
  }, [authUser, following]);

  const accept = async (id: string) => {
    await supabase.from('follows').update({ status: 'accepted' }).eq('id', id);
    toast.success('Demande acceptée');
    load();
  };
  const reject = async (id: string) => {
    await supabase.from('follows').delete().eq('id', id);
    load();
  };

  // Liste triée : moi en premier, puis ceux qui écoutent, puis les autres
  const sortedFollowing = [...following].sort((a, b) => {
    const pa = presences.get(a.user_id);
    const pb = presences.get(b.user_id);
    if (pa?.is_listening && !pb?.is_listening) return -1;
    if (!pa?.is_listening && pb?.is_listening) return 1;
    return 0;
  });


  const FriendRow = ({ p, showStatus }: { p: Profile; showStatus?: boolean }) => {
    const presence = presences.get(p.user_id);
    const isListening = presence?.is_listening ?? false;
    const lastSeen = presence?.last_seen_at ? new Date(presence.last_seen_at) : null;
    const isRecent = lastSeen && (Date.now() - lastSeen.getTime()) < 6000; // < 6s (2 cycles de ping)

    return (
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60">
        <button onClick={() => navigate(`/u/${p.user_id}`)} className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl(p)} />
            <AvatarFallback className="text-xs">{p.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
          {showStatus && (
            isListening ? (
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-background" />
            ) : isRecent ? (
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-yellow-500 ring-2 ring-background" />
            ) : null
          )}
        </button>
        <button onClick={() => navigate(`/u/${p.user_id}`)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium leading-tight">{p.pseudo}</p>
          {isListening && presence?.current_song_title ? (
            <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
              🎵 {presence.current_song_title}
              {presence.current_song_author ? ` — ${presence.current_song_author}` : ''}
            </p>
          ) : showStatus && !isRecent ? (
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Hors ligne</p>
          ) : showStatus && isRecent ? (
            <p className="text-[11px] text-yellow-500 leading-tight mt-0.5">En ligne</p>
          ) : null}
        </button>
        {presence?.current_song_cover_url && isListening && (
          <img
            src={presence.current_song_cover_url}
            alt=""
            className="h-8 w-8 rounded-md object-cover shrink-0"
          />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen px-3 py-4 pb-40">
      {/* Header compact */}
      <div className="mb-4 flex items-center justify-between" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <h1 className="text-lg font-bold">Social</h1>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => navigate('/search')}>
            <Search className="h-3.5 w-3.5 mr-1" /> Recherche
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => navigate('/listen-together')}>
            <Radio className="h-3.5 w-3.5 mr-1" /> Session
          </Button>
        </div>
      </div>

      {/* Tabs compacts */}
      <div style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="friends" className="text-xs">
              Amis {following.length > 0 && `(${following.length})`}
            </TabsTrigger>
            <TabsTrigger value="followers" className="text-xs">
              Abonnés {followers.length > 0 && `(${followers.length})`}
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs relative">
              Demandes
              {requests.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-2 space-y-0.5">
            {sortedFollowing.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <Users className="h-8 w-8 opacity-40" />
                <p>Tu ne suis personne pour l'instant.</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
                  <Search className="h-3.5 w-3.5 mr-1" /> Découvrir des profils
                </Button>
              </div>
            ) : (
              sortedFollowing.map((p) => (
                <FriendRow key={p.user_id} p={p} showStatus />
              ))
            )}
          </TabsContent>

          <TabsContent value="followers" className="mt-2 space-y-0.5">
            {followers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun abonné pour l'instant.</p>
            ) : (
              followers.map((p) => (
                <div key={p.user_id} style={{ animation: 'fadeSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <FriendRow p={p} showStatus />
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-2 space-y-0.5">
            {requests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune demande en attente.</p>
            ) : (
              requests.map((r) => r.profile && (
                <div key={r.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
                  <button onClick={() => navigate(`/u/${r.profile!.user_id}`)} className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={avatarUrl(r.profile)} />
                      <AvatarFallback className="text-xs">{r.profile.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                    </Avatar>
                    <p className="truncate text-sm font-medium">{r.profile.pseudo}</p>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => accept(r.id)}>Accepter</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => reject(r.id)}>X</Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}