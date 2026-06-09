import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import CachedImage from '@/components/CachedImage';
import { preloadImages } from '@/lib/mediaCache';
import StoryCircles from '@/components/StoryCircles';
import { useNavigate } from 'react-router-dom';
import {
  Play, Heart, Flame, TrendingUp, Sparkles,
  ListMusic, Globe, ArrowRight, Music2, Upload, AlertTriangle, Bell, Tag
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TrendingSection from '@/components/TrendingSection';
import { generateDailyMix } from '@/lib/dailyMix';
import type { Song, Playlist } from '@/types/music';
import TutorialModal from '@/components/TutorialModal';
import juxLogo from '@/assets/jux-logo.png';
import { useSeo } from '@/lib/useSeo';
import { cn } from '@/lib/utils';

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

function SectionHeader({
  icon: Icon,
  title,
  action,
  actionLabel = 'Voir tout',
}: {
  icon: React.ElementType;
  title: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      {action && (
        <button
          onClick={action}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const GENRE_COLORS: Record<string, string> = {
  'Hip-Hop': 'from-orange-500/20 to-yellow-500/10',
  'Rap': 'from-red-500/20 to-orange-500/10',
  'Pop': 'from-pink-500/20 to-purple-500/10',
  'R&B': 'from-purple-500/20 to-pink-500/10',
  'Trap': 'from-slate-500/20 to-gray-500/10',
  'Electronic': 'from-cyan-500/20 to-blue-500/10',
  'Rock': 'from-zinc-500/20 to-stone-500/10',
  'Jazz': 'from-amber-500/20 to-yellow-500/10',
  'Classical': 'from-indigo-500/20 to-violet-500/10',
  'Afrobeats': 'from-green-500/20 to-emerald-500/10',
  'Drill': 'from-gray-700/20 to-slate-600/10',
  'Soul': 'from-rose-500/20 to-pink-500/10',
};

function genreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? 'from-primary/10 to-primary/5';
}

export default function Home() {
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [trending, setTrending] = useState<Song[]>([]);
  const [dailyMix, setDailyMix] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useSeo({
    title: 'Accueil — Jux-Music',
    description: 'Découvre ton Daily Mix, les tendances et les nouveautés musicales partagées par la communauté Jux-Music.',
    path: '/jux',
  });

  useEffect(() => {
    (async () => {
      const [recentRes, topRes] = await Promise.all([
        pb.collection('songs').getList(1, 100, { sort: '-created', requestKey: null }),
        pb.collection('songs').getList(1, 10, { sort: '-weekly_play_count', requestKey: null }),
      ]);
      setSongs(recentRes.items.map(recordToSong));
      setTrending(topRes.items.map(recordToSong));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const result = await pb.collection('playlists').getList(1, 30, {
        filter: 'is_public = true',
        sort: '-likes_count',
        requestKey: null,
      });
      const all = result.items.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        is_public: r.is_public,
        owner_id: r.owner_id,
        view_count: r.view_count,
        play_count: r.play_count,
        likes_count: r.likes_count,
        thumbnail_mode: r.thumbnail_mode,
        created_at: r.created || r.created,
        updated_at: r.updated || r.updated,
      })) as Playlist[];
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      setPublicPlaylists(shuffled.slice(0, 10));
      setPlaylistsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    generateDailyMix(user.id).then(setDailyMix);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    pb.collection('notifications').getList(1, 1, {
      filter: `recipient_id = "${user.id}" && is_read = false`,
      requestKey: null,
    }).then((r) => setUnreadCount(r.totalItems)).catch(() => {});
  }, [user]);

  // Build genre groups from songs
  const genreGroups = (() => {
    const map: Record<string, Song[]> = {};
    for (const s of songs) {
      const g = s.genre?.trim();
      if (!g) continue;
      if (!map[g]) map[g] = [];
      map[g].push(s);
    }
    return Object.entries(map)
      .filter(([, arr]) => arr.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);
  })();

  const allGenres = genreGroups.map(([g]) => g);

  const filteredSongs = selectedGenre
    ? songs.filter((s) => s.genre?.trim() === selectedGenre)
    : songs;

  return (
    <div className="relative min-h-screen pb-48">
      {/* Hero ambient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-hero" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 pt-5 pb-3">
        <img src={juxLogo} alt="Jux" className="h-7 w-auto" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-muted-foreground hover:border-white/20 hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-white/20 hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </header>

      {/* Alert banner */}
      <div className="mx-4 mb-5 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400/80" />
        <div>
          <p className="text-xs font-semibold text-amber-300/90">Maintenance en cours</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/60">
            Seules les fonctionnalités principales sont disponibles. Le site est mis à jour en continu.
          </p>
        </div>
      </div>

      {/* Greeting */}
      <div className="relative px-4 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bonjour{user ? ' 👋' : ' !'}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Découvre de nouvelles musiques</p>
      </div>

      {/* Stories */}
      <div className="mb-6">
        <StoryCircles />
      </div>

      {/* Daily Mix */}
      {dailyMix.length > 0 && (
        <section className="relative mb-8 px-4 animate-fade-slide-up" style={{ animationDelay: '0.1s' }}>
          <SectionHeader icon={Sparkles} title="Daily Mix" />
          <button
            onClick={() => playSongFromList(dailyMix[0], dailyMix)}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-primary p-4 text-left shadow-elegant transition-all duration-200 hover:shadow-glow active:scale-[0.99]"
          >
            <div className="grid h-16 w-16 flex-shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl shadow-soft">
              {dailyMix.slice(0, 4).map((s) => (
                <CachedImage key={s.id} src={songCoverUrl(s)} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/70">Pour toi</p>
              <p className="truncate text-base font-bold text-primary-foreground">Ton Daily Mix</p>
              <p className="truncate text-xs text-primary-foreground/70">{dailyMix.length} titres sélectionnés</p>
            </div>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-black/20 text-white shadow-elegant transition-all duration-200 group-hover:scale-110">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </button>
        </section>
      )}

      {/* Trending */}
      {trending.length > 0 && <TrendingSection trending={trending} />}

      {/* Genre playlists */}
      {!loading && genreGroups.length > 0 && (
        <section className="relative mb-8 animate-fade-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="mb-4 flex items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <Tag className="h-4 w-4 text-primary" strokeWidth={2} />
              <h2 className="text-base font-bold tracking-tight text-foreground">Par genre</h2>
            </div>
          </div>

          {/* Genre pills */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-hide">
            <button
              onClick={() => setSelectedGenre(null)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                selectedGenre === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/[0.06] text-muted-foreground border border-white/[0.08] hover:text-foreground'
              )}
            >
              Tout
            </button>
            {allGenres.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                  selectedGenre === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/[0.06] text-muted-foreground border border-white/[0.08] hover:text-foreground'
                )}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Genre rows or filtered grid */}
          {selectedGenre ? (
            <div className="px-4">
              <div className="grid grid-cols-2 gap-3">
                {filteredSongs.map((s) => (
                  <SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, filteredSongs)} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {genreGroups.map(([genre, genreSongs]) => (
                <div key={genre}>
                  <div className="mb-3 flex items-center justify-between px-4">
                    <button
                      onClick={() => setSelectedGenre(genre)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-gradient-to-r',
                          genreColor(genre),
                          'text-foreground border border-white/[0.06]'
                        )}
                      >
                        {genre}
                      </span>
                      <span className="text-xs text-muted-foreground">{genreSongs.length} titres</span>
                    </button>
                    <button
                      onClick={() => playSongFromList(genreSongs[0], genreSongs)}
                      className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10"
                    >
                      <Play className="h-3 w-3 fill-current" /> Lancer
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
                    {genreSongs.slice(0, 12).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => playSongFromList(s, genreSongs)}
                        className="group flex-shrink-0 w-28 text-left"
                      >
                        <div className="relative mb-1.5 aspect-square w-28 overflow-hidden rounded-xl">
                          <img src={songCoverUrl(s)} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                            <Play className="h-7 w-7 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        </div>
                        <p className="truncate text-xs font-semibold text-foreground">{s.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{s.author}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Public Playlists */}
      <section className="relative mb-8 px-4 animate-fade-slide-up" style={{ animationDelay: '0.2s' }}>
        <SectionHeader
          icon={Globe}
          title="Playlists Publiques"
          action={() => navigate('/playlists')}
        />
        {playlistsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] w-44 flex-shrink-0 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : publicPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-gradient-card py-10 text-center">
            <ListMusic className="mb-3 h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Pas encore de playlists publiques</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {publicPlaylists.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/playlist/${p.id}`)}
                className="group flex w-44 flex-shrink-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 text-left hover:border-white/10 hover:bg-white/[0.07]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant-sm">
                  <ListMusic className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart className="h-2.5 w-2.5" />
                    {p.likes_count}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Découverte */}
      <section className="relative px-4 animate-fade-slide-up" style={{ animationDelay: '0.3s' }}>
        <SectionHeader icon={TrendingUp} title="Découvre" />
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-gradient-card py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Music2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium text-foreground">Aucune musique pour l'instant</p>
            <p className="mb-4 text-xs text-muted-foreground">Sois le premier à uploader !</p>
            <button
              onClick={() => navigate('/upload')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant-sm hover:shadow-glow active:scale-[0.98]"
            >
              <Upload className="h-3.5 w-3.5" />
              Uploader
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s) => (
              <SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />
            ))}
          </div>
        )}
      </section>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}
