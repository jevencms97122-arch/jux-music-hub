import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import StoryCircles from '@/components/StoryCircles';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Bell, Heart, Flame, TrendingUp, Sparkles, Car, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateDailyMix } from '@/lib/dailyMix';
import type { Song } from '@/types/music';
import juxLogo from '@/assets/jux-logo.png';

export default function Home() {
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [trending, setTrending] = useState<Song[]>([]);
  const [dailyMix, setDailyMix] = useState<Song[]>([]);
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

  useEffect(() => {
    if (!authUser) return;
    generateDailyMix(authUser.id).then(setDailyMix);
  }, [authUser]);

  return (
    <div className="relative min-h-screen pb-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-hero" />

      <header className="relative flex items-center justify-between p-4">
        <img src={juxLogo} alt="Jux" className="h-8" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/car')} aria-label="Mode voiture">
            <Car className="h-5 w-5" />
          </Button>
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

      <div className="relative px-4 pb-6">
        <h1 className="text-3xl font-bold text-foreground">Bonjour !</h1>
        <p className="text-muted-foreground">Découvrez de nouvelles musiques</p>
      </div>

      <StoryCircles />

      {dailyMix.length > 0 && (
        <section className="relative mb-8 px-4">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Daily Mix</h2>
          </div>
          <button
            onClick={() => playSongFromList(dailyMix[0], dailyMix)}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-primary p-4 text-left shadow-elegant transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="grid h-20 w-20 flex-shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
              {dailyMix.slice(0, 4).map((s) => (
                <img key={s.id} src={songCoverUrl(s)} alt="" className="h-full w-full object-cover" loading="lazy" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/80">Pour toi</p>
              <p className="truncate text-lg font-bold text-primary-foreground">Ton Daily Mix</p>
              <p className="truncate text-xs text-primary-foreground/80">{dailyMix.length} titres rien que pour toi</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-elegant transition-transform group-hover:scale-110">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </button>
        </section>
      )}

      {trending.length > 0 && (
        <section className="relative mb-8 px-4">
          <div className="mb-4 flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Tendances</h2>
          </div>
          <div className="-mx-4 flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-2">
            {trending.slice(0, 5).map((s, i) => (
              <button
                key={s.id}
                onClick={() => playSongFromList(s, trending)}
                className="group relative flex w-48 flex-shrink-0 flex-col gap-3 text-left"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-card transition-transform group-hover:scale-105">
                  <img src={songCoverUrl(s)} alt={s.title} loading="lazy"
                    className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-elegant">
                      {i + 1}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
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
