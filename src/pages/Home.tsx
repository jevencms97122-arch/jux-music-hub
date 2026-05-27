import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import StoryCircles from '@/components/StoryCircles';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Bell, Heart, Flame, TrendingUp, Sparkles, Car, Play, HelpCircle, ListMusic, Globe, ArrowRight, Music2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TrendingSection from '@/components/TrendingSection';
import { generateDailyMix } from '@/lib/dailyMix';
import type { Song, Playlist } from '@/types/music';
import CollabCard from '@/components/CollabCard';
import { collaborations } from '@/data/collaborations';
import TutorialModal from '@/components/TutorialModal';
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
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: recent }, { data: top }] = await Promise.all([
        supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('songs').select('*').order('weekly_play_count', { ascending: false }).limit(10),
      ]);
      setSongs((recent ?? []) as Song[]);
      setTrending((top ?? []) as Song[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('playlists').select('*')
        .eq('is_public', true)
        .order('likes_count', { ascending: false }).limit(30);
      const all = (data ?? []) as Playlist[];
      // pick 10 random
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      setPublicPlaylists(shuffled.slice(0, 10));
      setPlaylistsLoading(false);
    })();
  }, [authUser]);

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

      {/* ── Header & logo ── */}
      <header
        className="relative flex items-center justify-between p-4"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <img src={juxLogo} alt="Jux" className="h-8" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" onClick={() => setTutorialOpen(true)}
            aria-label="Tutoriel"
            style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.04s' }}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => navigate('/car')}
            aria-label="Mode voiture"
            style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.08s' }}
          >
            <Car className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => navigate('/search')}
            style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.14s' }}
          >
            <SearchIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon" onClick={() => navigate('/favorites')}
            style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.20s' }}
          >
            <Heart className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="relative"
            onClick={() => navigate('/notifications')}
            style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.26s' }}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary shadow-elegant" />}
          </Button>
        </div>
      </header>

      {/* ── Greeting ── */}
      <div
        className="relative px-4 pb-6"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.15s' }}
      >
        <h1 className="text-3xl font-bold text-foreground">Bonjour !</h1>
        <p className="text-muted-foreground">Découvrez de nouvelles musiques</p>
      </div>

      {/* ── Story circles ── */}
      <div style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.30s' }}>
        <StoryCircles />
      </div>

      {/* ── Daily Mix ── */}
      {dailyMix.length > 0 && (
        <section
          className="relative mb-8 px-4"
          style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.45s' }}
        >
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

      {/* ── Collaborations ── */}
      {collaborations.length > 0 && (
        <section
          className="relative mb-8 px-4"
          style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.55s' }}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant-sm">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Collaborations</h2>
              <p className="text-xs text-muted-foreground">Créateurs & artistes</p>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {collaborations.map((collab, i) => (
              <div
                key={collab.id}
                className="flex-shrink-0"
                style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.6 + i * 0.08}s` }}
              >
                <CollabCard collab={collab} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Trending ── */}
      {trending.length > 0 && (
        <TrendingSection trending={trending} />
      )}

      {/* ── Playlists Publiques ── */}
      <section
        className="relative mb-8 px-4"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.65s' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Playlists Publiques</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground"
            onClick={() => navigate('/playlists')}
          >
            Voir tout <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {playlistsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] w-48 flex-shrink-0 animate-pulse rounded-xl bg-secondary"
              />
            ))}
          </div>
        ) : publicPlaylists.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Pas encore de playlists publiques.
            </p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {publicPlaylists.map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate(`/playlist/${p.id}`)}
                className="group flex w-48 flex-shrink-0 items-center gap-3 rounded-xl border border-transparent bg-card/50 p-2.5 text-left transition-all hover:border-border hover:bg-card hover:shadow-card"
                style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.7 + i * 0.04}s` }}
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-card">
                  <ListMusic className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart className="h-3 w-3" />
                    {p.likes_count}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Discover ── */}
      <section
        className="relative px-4"
        style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.85s' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Découvre</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl bg-secondary"
                style={{ animation: 'fadeIn 0.4s ease-out both', animationDelay: `${0.80 + i * 0.05}s` }}
              />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div
            className="rounded-xl border border-border bg-card p-8 text-center"
            style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.80s' }}
          >
            <p className="text-sm text-muted-foreground">
              Aucune musique pour l'instant. Sois le premier à uploader !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s, i) => (
              <div
                key={s.id}
                style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.80 + i * 0.04}s` }}
              >
                <SongCard song={s} onPlay={() => playSongFromList(s, songs)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Tutoriel Modal ── */}
      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}
