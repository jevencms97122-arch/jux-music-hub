import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { avatarUrl, songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { Headphones, Users } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Profile, Follow, Song } from '@/types/music';

interface FriendActivity {
  user: Profile;
  song: Song;
  listened_at: string;
}

export default function Social() {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const { playSongFromList } = usePlayer();
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<(Follow & { profile?: Profile })[]>([]);
  const [activity, setActivity] = useState<FriendActivity[]>([]);

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
    setFollowers(await fetchProfiles((inF ?? []).map((f) => f.follower_id)));
    const reqProfiles = await fetchProfiles((req ?? []).map((r) => r.follower_id));
    setRequests((req ?? []).map((r) => ({
      ...(r as Follow),
      profile: reqProfiles.find((p) => p.user_id === r.follower_id),
    })));

    if (followingIds.length > 0) {
      const { data: recentLikes } = await supabase
        .from('song_likes')
        .select('song_id, user_id, created_at')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20);

      const songIds = Array.from(new Set((recentLikes ?? []).map((l: any) => l.song_id)));
      if (songIds.length > 0) {
        const { data: songs } = await supabase.from('songs').select('*').in('id', songIds);
        const songsMap = new Map((songs ?? []).map((s: any) => [s.id, s]));
        const items: FriendActivity[] = (recentLikes ?? [])
          .map((l: any) => ({
            user: followingProfiles.find((p) => p.user_id === l.user_id)!,
            song: songsMap.get(l.song_id) as Song,
            listened_at: l.created_at,
          }))
          .filter((a) => a.user && a.song);
        setActivity(items);
      }
    }
  };

  useEffect(() => { load(); }, [authUser]);

  // Realtime : nouveaux likes des amis
  useEffect(() => {
    if (!authUser || following.length === 0) return;
    const channel = supabase
      .channel('friend-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'song_likes' }, async (payload: any) => {
        const friendIds = following.map((f) => f.user_id);
        if (!friendIds.includes(payload.new.user_id)) return;
        const { data: song } = await supabase.from('songs').select('*').eq('id', payload.new.song_id).maybeSingle();
        if (!song) return;
        setActivity((prev) => [
          { user: following.find((f) => f.user_id === payload.new.user_id)!, song: song as Song, listened_at: payload.new.created_at },
          ...prev,
        ].slice(0, 30));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  const Row = ({ p, action }: { p: Profile; action?: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary">
      <button onClick={() => navigate(`/u/${p.user_id}`)} className="flex flex-1 items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl(p)} />
          <AvatarFallback>{p.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <p className="text-left text-sm font-medium">{p.pseudo}</p>
      </button>
      {action}
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-6 pb-40">
      <div className="mb-4 flex items-center justify-between" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <h1 className="text-xl font-bold">Social</h1>
        <Button size="sm" variant="outline" onClick={() => navigate('/listen-together')}>
          <Users className="mr-2 h-4 w-4" /> Écoute partagée
        </Button>
      </div>
      <div style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}>
        <Tabs defaultValue="activity">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="activity">Activité</TabsTrigger>
            <TabsTrigger value="following">Abonnements</TabsTrigger>
            <TabsTrigger value="followers">Abonnés</TabsTrigger>
            <TabsTrigger value="requests">Demandes {requests.length > 0 && `(${requests.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-2">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune activité récente. Suis des amis pour voir ce qu'ils écoutent.</p>
            ) : activity.map((a, i) => (
              <button
                key={i}
                onClick={() => playSongFromList(a.song, [a.song])}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"
                style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl(a.user)} />
                  <AvatarFallback>{a.user.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
                <img src={songCoverUrl(a.song)} alt="" className="h-10 w-10 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{a.user.pseudo}</span>{' '}
                    <span className="text-muted-foreground">a aimé</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.song.title} • {a.song.author}</p>
                </div>
                <Headphones className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="following" className="mt-4 space-y-1">
            {following.length === 0 ? <p className="text-sm text-muted-foreground">Aucun abonnement.</p> :
              following.map((p, i) => <div key={p.id} style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}><Row p={p} /></div>)}
          </TabsContent>
          <TabsContent value="followers" className="mt-4 space-y-1">
            {followers.length === 0 ? <p className="text-sm text-muted-foreground">Aucun abonné.</p> :
              followers.map((p, i) => <div key={p.id} style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}><Row p={p} /></div>)}
          </TabsContent>
          <TabsContent value="requests" className="mt-4 space-y-1">
            {requests.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande.</p> :
              requests.map((r, i) => r.profile && (
                <div key={r.id} style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}>
                  <Row p={r.profile} action={
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => accept(r.id)}>Accepter</Button>
                      <Button size="sm" variant="ghost" onClick={() => reject(r.id)}>Refuser</Button>
                    </div>
                  } />
                </div>
              ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}