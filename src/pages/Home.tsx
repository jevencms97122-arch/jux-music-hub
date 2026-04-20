import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import StoryCircles from '@/components/StoryCircles';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Bell, Heart, Flame, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Song } from '@/types/music';
import juxLogo from '@/assets/jux-logo.png';

export default function Home() {
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [trending, setTrending] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: recent }, { data: top }] = await Promise.all([
        supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('songs').select('*').order('play_count', { ascending: false }).limit(10),
      ]);
      setSongs((recent ?? []) as Song[]);
      setTrending((top ?? []) as Song[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const { count } = await supabase
        .from('notifications').select('*', { count: 'exact', head: true })
        .eq('recipient_id', authUser.id).eq('is_read', false);
      setUnread(count ?? 0);
    })();
  }, [authUser]);

  return (
    <div className="relative min-h-screen pb-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-hero" />

      <header className="relative flex items-center justify-between p-4">
        <img src={juxLogo} alt="Jux" className="h-8" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/search')}>
            <SearchIcon className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/favorites')}>
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary shadow-elegant" />}
          </Button>
        </div>
      </header>

      <StoryCircles />

      {trending.length > 0 && (
        <section className="relative mb-6 px-4">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Tendances</h2>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
            {trending.map((s, i) => (
              <button
                key={s.id}
                onClick={() => playSongFromList(s, trending)}
                className="group relative flex w-40 flex-shrink-0 flex-col gap-2 text-left"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-card">
                  <img src={s.cover_url ?? '/placeholder.svg'} alt={s.title} loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                  <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground shadow-elegant">
                    {i + 1}
                  </div>
                </div>
                <div>
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="relative px-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Découvre</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune musique pour l'instant. Sois le premier à uploader !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s) => (
              <SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
