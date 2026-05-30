import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { ArrowLeft } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { getUserStats } from '@/lib/streaks';
import type { Profile, Song } from '@/types/music';

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [streak, setStreak] = useState(0);

  const load = async () => {
    if (!userId) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    setProfile(p as Profile | null);

    const { data: s } = await supabase
      .from('songs').select('*').eq('uploaded_by', userId).order('created_at', { ascending: false });
    setSongs((s ?? []) as Song[]);

    const [{ count: fers }, { count: fing }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
    ]);
    setCounts({ followers: fers ?? 0, following: fing ?? 0 });

    const statsData = await getUserStats(userId);
    setStreak(statsData?.current_streak ?? 0);

    if (authUser && authUser.id !== userId) {
      const { data: f } = await supabase
        .from('follows').select('status')
        .eq('follower_id', authUser.id).eq('following_id', userId).maybeSingle();
      setFollowStatus((f?.status as any) ?? 'none');
    }
  };

  useEffect(() => { load(); }, [userId, authUser]);

  const follow = async () => {
    if (!authUser || !userId) return;
    const { error } = await supabase.from('follows').insert({
      follower_id: authUser.id, following_id: userId, status: 'accepted',
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from('notifications').insert({
      recipient_id: userId,
      type: 'friend_request',
      title: 'Nouvel abonné',
      body: `${authUser.email} vous suit`,
    });
    setFollowStatus('accepted');
  };

  const unfollow = async () => {
    if (!authUser || !userId) return;
    await supabase.from('follows').delete()
      .eq('follower_id', authUser.id).eq('following_id', userId);
    setFollowStatus('none');
  };

  if (!profile) return <div className="p-6 text-sm text-muted-foreground">Chargement...</div>;

  const isMe = authUser?.id === profile.user_id;

  return (
    <div className="min-h-screen pb-40">
      <header className="flex items-center gap-2 p-4" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 truncate font-bold">@{profile.pseudo}</h1>
      </header>

      <div className="flex flex-col items-center gap-2 px-6" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}>
        <Avatar className="h-24 w-24" style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.15s' }}>
          <AvatarImage src={avatarUrl(profile)} />
          <AvatarFallback>{profile.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <h2 className="text-lg font-bold">{profile.pseudo}</h2>
          {streak >= 3 && (
            <span
              className="inline-flex items-center gap-1 text-sm font-semibold text-orange-400"
              title={`${streak} jours d'écoute consécutifs`}
            >
              <span className="text-lg drop-shadow-[0_0_6px_rgba(255,165,0,0.5)]">🔥</span>
              <span>{streak}</span>
            </span>
          )}
        </div>
        {profile.bio && <p className="max-w-md text-center text-sm text-muted-foreground">{profile.bio}</p>}
        <div className="flex gap-6 text-sm">
          <div className="text-center"><p className="font-bold">{counts.followers}</p><p className="text-muted-foreground">Abonnés</p></div>
          <div className="text-center"><p className="font-bold">{counts.following}</p><p className="text-muted-foreground">Suivis</p></div>
          <div className="text-center"><p className="font-bold">{songs.length}</p><p className="text-muted-foreground">Titres</p></div>
        </div>
        {!isMe && (
          followStatus === 'accepted' ? (
            <Button variant="outline" onClick={unfollow}>Se désabonner</Button>
          ) : followStatus === 'pending' ? (
            <Button variant="outline" disabled>Demande envoyée</Button>
          ) : (
            <Button onClick={follow}>Suivre</Button>
          )
        )}
      </div>

      <section className="mt-8 px-4" style={{ animation: 'fadeIn 0.6s ease-out both', animationDelay: '0.25s' }}>
        <h3 className="mb-3 text-sm font-bold text-muted-foreground">Morceaux publiés</h3>
        {songs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun morceau publié.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s, i) => (
              <div key={s.id} style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.3 + i * 0.04}s` }}>
                <SongCard song={s} onPlay={() => playSongFromList(s, songs)} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}