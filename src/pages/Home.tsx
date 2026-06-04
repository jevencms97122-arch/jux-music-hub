import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import CachedImage from '@/components/CachedImage';
import { preloadImages } from '@/lib/mediaCache';
import StoryCircles from '@/components/StoryCircles';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Bell, Heart, Flame, TrendingUp, Sparkles, Car, Play, HelpCircle, ListMusic, Globe, ArrowRight, Music2, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TrendingSection from '@/components/TrendingSection';
import { generateDailyMix } from '@/lib/dailyMix';
import type { Song, Playlist } from '@/types/music';
import CollabCard from '@/components/CollabCard';
import { collaborations } from '@/data/collaborations';
import TutorialModal from '@/components/TutorialModal';
import juxLogo from '@/assets/jux-logo.png';
import { useSeo } from '@/lib/useSeo';

function recordToSong(r: any): Song {
  return {
    id: r.id,
    title: r.title || '',
    author: r.author || '',
    audio: r.audio || '',
    cover: r.cover || null,
    audio_url: r.audio_url || '',
    cover_url: r.cover_url || null,
    video_url: r.video_url || null,
    genre: r.genre || null,
    uploaded_by: r.uploaded_by || '',
    duration: r.duration || 0,
    play_count: r.play_count ?? 0,
    weekly_play_count: r.weekly_play_count ?? 0,
    likes_count: r.likes_count ?? 0,
    created_at: r.created,
    updated_at: r.updated,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
  };
}

export default function Home() {
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [trending, setTrending] = useState<Song[]>([]);
  const [dailyMix, setDailyMix] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useSeo({
    title: 'Accueil — Jux-Music',
    description: 'Découvre ton Daily Mix, les tendances et les nouveautés musicales partagées par la communauté Jux-Music.',
    path: '/jux',
  });
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [recentRes, topRes] = await Promise.all([
        pb.collection('songs').getList(1, 50, { sort: '-created', requestKey: null }),
        pb.collection('songs').getList(1, 10, { sort: '-weekly_play_count', requestKey: null }),
      ]);
      setSongs(recentRes.items.map(recordToSong));
      setTrending(topRes.items.map(recordToSong));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const result = await pb.collection('playlists').getList(1, 30, { filter: 'is_public = true', sort: '-likes_count', requestKey: null });
      const all = result.items.map((r: any) => ({ id: r.id, title: r.get('title'), description: r.get('description'), is_public: r.get('is_public'), owner_id: r.get('owner_id'), view_count: r.get('view_count'), play_count: r.get('play_count'), likes_count: r.get('likes_count'), thumbnail_mode: r.get('thumbnail_mode'), created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated })) as Playlist[];
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      setPublicPlaylists(shuffled.slice(0, 10));
      setPlaylistsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await pb.collection('notifications').getList(1, 1, { filter: `recipient_id = "${user.id}" && is_read = false`, requestKey: null });
      setUnread(result.totalItems);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    generateDailyMix(user.id).then(setDailyMix);
  }, [user]);

  return (
    <div className="relative min-h-screen pb-48">
      {/* Hero gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-hero" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 pt-4 pb-2">
        <img src={juxLogo} alt="Jux" className="h-8" />
          <div className="flex items-center gap-0.5">
            {/* Removed Tutorial button */}
            {/* Removed Car button */}
            {/* Removed Wrapped button */}
          </div>
      </header>

      {/* Alert banner */}
      <div className="mx-4 mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200 shadow-soft backdrop-blur-sm">
        <p className="font-semibold">Maintenance prévue en cours de migration</p>
        <p className="mt-1 text-amber-200/80">Seules les fonctionnalités les plus utiles sont disponibles le temps de tout remettre. Le site peut être hors ligne de temps en temps, le site est mis à jour constamment.</p>
      </div>

      {/* Greeting */}
      <div className="relative px-4 pb-4">
        <h1 className="text-3xl font-bold text-foreground">Bonjour !</h1>
        <p className="text-muted-foreground">Découvre de nouvelles musiques</p>
      </div>

      {/* Stories */}
      <div className="mb-6"><StoryCircles /></div>

      {/* Daily Mix */}
      {dailyMix.length > 0 && (
        <section className="relative mb-8 px-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant-sm">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Daily Mix</h2>
          </div>
          <button
            onClick={() => playSongFromList(dailyMix[0], dailyMix)}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-primary p-4 text-left shadow-elegant transition-all duration-300 hover:shadow-glow hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="grid h-20 w-20 flex-shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl shadow-soft">
              {dailyMix.slice(0, 4).map((s) => (
                <CachedImage key={s.id} src={songCoverUrl(s)} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/80">Pour toi</p>
              <p className="truncate text-lg font-bold text-primary-foreground">Ton Daily Mix</p>
              <p className="truncate text-xs text-primary-foreground/80">{dailyMix.length} titres rien que pour toi</p>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-background text-foreground shadow-elegant transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </button>
        </section>
      )}

      {/* Collaborators (app creators) section removed */}

      {/* Trending */}
      {trending.length > 0 && <TrendingSection trending={trending} />}

      {/* Public Playlists */}
      <section className="relative mb-8 px-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Playlists Publiques</h2>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => navigate('/playlists')}>
            Voir tout <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {playlistsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[72px] w-48 flex-shrink-0 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : publicPlaylists.length === 0 ? (
          <div className="rounded-xl border border-border bg-gradient-card p-6 text-center">
            <ListMusic className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Pas encore de playlists publiques.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {publicPlaylists.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/playlist/${p.id}`)}
                className="group flex w-48 flex-shrink-0 items-center gap-3 rounded-xl border border-white/5 bg-gradient-card p-2.5 text-left transition-all duration-200 hover:border-white/10 hover:shadow-card"
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-card">
                  <ListMusic className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart className="h-3 w-3" />{p.likes_count}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Discover section */}
      <section className="relative px-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Découvre</h2>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => navigate('/upload')}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-gradient-card p-8 text-center">
            <Music2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune musique pour l'instant. Sois le premier à uploader !</p>
            <Button variant="premium" size="sm" className="mt-4" onClick={() => navigate('/upload')}>
              <Upload className="h-4 w-4" /> Uploader une musique
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s) => (
              <div key={s.id}>
                <SongCard song={s} onPlay={() => playSongFromList(s, songs)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}