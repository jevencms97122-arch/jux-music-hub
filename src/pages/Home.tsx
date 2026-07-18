import { useEffect, useState, useMemo } from 'react';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import CachedImage from '@/components/CachedImage';
import StoryCircles from '@/components/StoryCircles';
import { useNavigate } from 'react-router-dom';
import {
  Play, Heart, Clock, Sparkles,
  ListMusic, Globe, ArrowRight, Music2, Upload, Bell, Tag, ChevronDown, ScrollText, Mic2, Car, History
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { getLocalTracks } from '@/lib/offlineLibrary';
import { getLocalListenHistory } from '@/lib/localListenHistory';
import { useLazySection } from '@/hooks/useLazySection';
import TrendingSection from '@/components/TrendingSection';
import AppBanner from '@/components/AppBanner';
import PatchNotesSheet from '@/components/PatchNotesSheet';
import { generateDailyMix } from '@/lib/dailyMix';
import type { Song, Playlist } from '@/types/music';
import TutorialModal from '@/components/TutorialModal';
import juxLogo from '@/assets/jux-logo.png';
import { useSeo } from '@/lib/useSeo';
import { cn } from '@/lib/utils';
import { recordToSong } from '@/lib/pbUtils';

// Shuffle déterministe : même ordre toute la journée, change chaque jour
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const daySeed = () => Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));

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

const DISCOVER_PAGE = 20;
const TUTORIAL_SEEN_KEY = 'jux_tutorial_seen';

export default function Home() {
  const { user, profile } = useAuth();
  const { offline } = useOfflineMode();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [trending, setTrending] = useState<Song[]>([]);
  const [dailyMix, setDailyMix] = useState<Song[]>([]);
  const [dailyMixGenre, setDailyMixGenre] = useState<string | null>(null);
  const [dailyMixLoading, setDailyMixLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(DISCOVER_PAGE);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [replaySongs, setReplaySongs] = useState<Song[]>([]);

  // Lazy loading : chaque section ne déclenche ses requêtes backend que quand
  // l'utilisateur s'en approche à l'écran (évite de charger ce qu'il ne verra pas)
  const trendingLazy = useLazySection();
  const songsLazy = useLazySection();
  const playlistsLazy = useLazySection();
  const artistsLazy = useLazySection();
  const replayLazy = useLazySection();

  useSeo({
    title: 'Accueil — Nexora Music',
    description: 'Découvre ton Daily Mix, les tendances et les nouveautés musicales partagées par la communauté Jux-Music.',
    path: '/jux',
  });

  // Tutoriel à la première visite
  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) setTutorialOpen(true);
    } catch {}
  }, []);

  const closeTutorial = () => {
    setTutorialOpen(false);
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); } catch {}
  };

  // Hors ligne : tout vient de l'appareil, pas de lazy loading nécessaire
  useEffect(() => {
    if (!offline) return;
    getLocalTracks().then((tracks) => {
      setSongs(tracks);
      setArtistSongs(tracks);
    }).finally(() => {
      setLoading(false);
      setTrendingLoading(false);
      setArtistsLoading(false);
    });
  }, [offline]);

  // Sons récents (sections Par genre + Nouveautés) — chargés à l'approche de la zone
  useEffect(() => {
    if (offline || !songsLazy.visible) return;
    (async () => {
      try {
        const recentRes = await pb.collection('songs').getList(1, 100, { sort: '-created', requestKey: null });
        setSongs(recentRes.items.map(recordToSong));
      } catch {}
      setLoading(false);
    })();
  }, [offline, songsLazy.visible]);

  // Tendances — chargées à l'approche de la section
  useEffect(() => {
    if (offline || !trendingLazy.visible) return;
    (async () => {
      try {
        const trendingRes = await pb.collection('trending_songs').getList(1, 10, { sort: '-score', requestKey: null });
        const trendingItems = trendingRes.items;
        if (trendingItems.length > 0) {
          const ids = trendingItems.map((t: any) => t.song_id);
          const filters = ids.map((id: string) => `id = "${id}"`).join(' || ');
          const songsRes = await pb.collection('songs').getList(1, 10, { filter: filters, requestKey: null });
          const songsById = Object.fromEntries(songsRes.items.map((s: any) => [s.id, s]));
          const ordered = ids.map((id: string) => songsById[id]).filter(Boolean).map(recordToSong);
          setTrending(ordered);
        } else {
          // Fallback si trending_songs est vide
          const fallback = await pb.collection('songs').getList(1, 10, { sort: '-weekly_play_count', requestKey: null });
          setTrending(fallback.items.map(recordToSong));
        }
      } catch {}
      setTrendingLoading(false);
    })();
  }, [offline, trendingLazy.visible]);

  // Classement artistes (requête lourde : 500 sons) — chargé à l'approche de la section
  useEffect(() => {
    if (offline || !artistsLazy.visible) return;
    (async () => {
      try {
        const artistRes = await pb.collection('songs').getList(1, 500, {
          sort: '-play_count',
          requestKey: 'artist-ranking',
        });
        setArtistSongs(artistRes.items.map(recordToSong));
      } catch {}
      setArtistsLoading(false);
    })();
  }, [offline, artistsLazy.visible]);

  useEffect(() => {
    if (offline) { setPlaylistsLoading(false); return; }
    if (!playlistsLazy.visible) return;
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
        created_at: r.created,
        updated_at: r.updated,
      })) as Playlist[];
      setPublicPlaylists(seededShuffle(all, daySeed()).slice(0, 10));
      setPlaylistsLoading(false);
    })();
  }, [offline]);

  useEffect(() => {
    if (!user) { setDailyMixLoading(false); return; }
    setDailyMixLoading(true);
    generateDailyMix(user.id)
      .then(({ songs, genre }) => {
        setDailyMix(songs);
        setDailyMixGenre(genre);
      })
      .catch(() => {})
      .finally(() => setDailyMixLoading(false));
  }, [user]);

  // Section "Réécouter" — pioche aléatoirement dans les sons déjà écoutés
  useEffect(() => {
    const shuffleRandom = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    if (offline) {
      // Hors ligne : croise l'historique local avec les sons présents sur l'appareil
      (async () => {
        const ids = getLocalListenHistory();
        if (ids.length === 0) return;
        const tracks = await getLocalTracks();
        const listened = tracks.filter((t) => ids.includes(t.id));
        setReplaySongs(shuffleRandom(listened).slice(0, 12));
      })().catch(() => {});
      return;
    }

    if (!user || !replayLazy.visible) return;
    (async () => {
      try {
        const hist = await pb.collection('listen_history').getList(1, 200, {
          filter: `user_id = "${user.id}"`,
          sort: '-listened_at',
          requestKey: null,
        });
        const ids = [...new Set(hist.items.map((h: any) => h.song_id))] as string[];
        if (ids.length === 0) return;
        const pick = shuffleRandom(ids).slice(0, 12);
        const filter = pick.map((id) => `id = "${id}"`).join(' || ');
        const res = await pb.collection('songs').getList(1, 12, { filter, requestKey: null });
        const byId = Object.fromEntries(res.items.map((s: any) => [s.id, s]));
        setReplaySongs(pick.map((id) => byId[id]).filter(Boolean).map(recordToSong));
      } catch {
        // silencieux : la section est simplement masquée
      }
    })();
  }, [offline, user, replayLazy.visible]);

  // Badge notifications rafraîchi toutes les 30 s
  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      pb.collection('notifications').getList(1, 1, {
        filter: `recipient_id = "${user.id}" && is_read = false`,
        requestKey: null,
      }).then((r) => setUnreadCount(r.totalItems)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
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

  const topArtists = useMemo(() => {
    const map: Record<string, { name: string; totalPlays: number; songs: Song[] }> = {};
    for (const s of artistSongs) {
      const name = s.author?.trim();
      if (!name) continue;
      if (!map[name]) map[name] = { name, totalPlays: 0, songs: [] };
      map[name].totalPlays += s.play_count ?? 0;
      map[name].songs.push(s);
    }
    return Object.values(map)
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, 10);
  }, [artistSongs]);

  const filteredSongs = selectedGenre
    ? songs.filter((s) => s.genre?.trim() === selectedGenre)
    : songs;

  const hour = new Date().getHours();
  const hello = hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';

  return (
    <div className="relative min-h-screen pb-48">
      {/* Hero ambient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-hero" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 pt-5 pb-3">
        <img src="/jux-icon-511.png" alt="Nexora-Music" className="h-9 w-auto rounded-xl" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/car-mode')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/60 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            aria-label="Mode voiture"
          >
            <Car className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/60 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <PatchNotesSheet
            trigger={
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/60 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                aria-label="Notes de mise à jour"
              >
                <ScrollText className="h-4 w-4" />
              </button>
            }
          />
          <button
            onClick={() => navigate('/upload')}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border/50 bg-card/60 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </header>

      {/* Bannière configurable depuis PocketBase (collection app_banners) */}
      <AppBanner className="mx-4 mb-5" />

      {/* Greeting */}
      <div className="relative px-4 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {hello}{profile?.pseudo ? `, ${profile.pseudo}` : ''} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Découvre de nouvelles musiques</p>
      </div>

      {/* Stories */}
      <div className="mb-6">
        <StoryCircles />
      </div>

      {/* Daily Mix */}
      {user && dailyMixLoading ? (
        <section className="relative mb-8 px-4">
          <div className="mb-4 h-5 w-28 animate-pulse rounded bg-secondary" />
          <div className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card/30 p-4">
            <div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-xl bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        </section>
      ) : dailyMix.length > 0 && (
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/70">Pour toi · 3 derniers jours</p>
              <p className="truncate text-base font-bold text-primary-foreground">
                Daily Mix{dailyMixGenre ? ` · ${dailyMixGenre}` : ''}
              </p>
              <p className="truncate text-xs text-primary-foreground/70">
                {dailyMix.length} titres{dailyMixGenre ? ` • Genre favori : ${dailyMixGenre}` : ''}
              </p>
            </div>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-black/20 text-white shadow-elegant transition-all duration-200 group-hover:scale-110">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </button>
        </section>
      )}

      {/* Trending — requêtes lancées quand la section approche de l'écran */}
      <div ref={trendingLazy.ref}>
        {trendingLoading ? (
          <section className="relative mb-8 px-4">
            <div className="mb-4 h-5 w-32 animate-pulse rounded bg-secondary" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-36 flex-shrink-0 space-y-2">
                  <div className="aspect-square w-full animate-pulse rounded-xl bg-secondary" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          </section>
        ) : trending.length > 0 && <TrendingSection trending={trending} />}
      </div>

      {/* Sentinelle lazy pour les sons récents (Par genre + Nouveautés) */}
      <div ref={songsLazy.ref} aria-hidden />

      {/* Genre playlists */}
      {loading && !offline && (
        <section className="relative mb-8 px-4">
          <div className="mb-4 h-5 w-28 animate-pulse rounded bg-secondary" />
          <div className="flex gap-2 pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-secondary" />
            ))}
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-28 flex-shrink-0 space-y-1.5">
                <div className="aspect-square w-full animate-pulse rounded-xl bg-secondary" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
        </section>
      )}
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredSongs.map((s, i) => (
                  <SongCard key={s.id} song={s} index={i} onPlay={() => playSongFromList(s, filteredSongs)} />
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
                  <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 scrollbar-hide">
                    {genreSongs.slice(0, 12).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => playSongFromList(s, genreSongs)}
                        className="group w-28 flex-shrink-0 snap-start text-left"
                      >
                        <div className="relative mb-1.5 aspect-square w-28 overflow-hidden rounded-xl">
                          <CachedImage src={songCoverUrl(s)} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
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

      {/* Public Playlists — requêtes lancées quand la section approche de l'écran */}
      <section ref={playlistsLazy.ref} className="relative mb-8 px-4 animate-fade-slide-up" style={{ animationDelay: '0.2s' }}>
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/40 py-10 text-center backdrop-blur-xl">
            <ListMusic className="mb-3 h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Pas encore de playlists publiques</p>
          </div>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {publicPlaylists.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/playlist/${p.id}`)}
                className="group flex w-44 flex-shrink-0 snap-start items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 text-left hover:border-white/10 hover:bg-white/[0.07]"
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

      {/* Top Artistes — requête lourde (500 sons) lancée quand la section approche de l'écran */}
      <div ref={artistsLazy.ref}>
      {artistsLoading && !offline && (
        <section className="relative mb-8 px-4">
          <div className="mb-4 h-5 w-28 animate-pulse rounded bg-secondary" />
          <div className="mb-3 flex gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/40 p-3">
                <div className="h-16 w-16 animate-pulse rounded-full bg-secondary" />
                <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
                <div className="h-2.5 w-10 animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-card/40 px-3 py-2.5">
                <div className="h-10 w-10 animate-pulse rounded-full bg-secondary" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-24 animate-pulse rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {!artistsLoading && topArtists.length > 0 && (
        <section className="relative mb-8 px-4 animate-fade-slide-up" style={{ animationDelay: '0.25s' }}>
          <SectionHeader icon={Mic2} title="Top Artistes" />

          {/* Podium top 3 */}
          <div className="mb-3 flex gap-2.5">
            {topArtists.slice(0, 3).map((artist, i) => {
              const coverSong = artist.songs.find((s) => s.cover_url) ?? artist.songs[0];
              const cover = coverSong ? songCoverUrl(coverSong) : null;
              const podiumBg = i === 0
                ? 'from-yellow-500/20 via-yellow-500/8 to-transparent border-yellow-500/25'
                : i === 1
                ? 'from-zinc-400/15 via-zinc-400/5 to-transparent border-zinc-400/20'
                : 'from-amber-700/20 via-amber-700/8 to-transparent border-amber-700/25';
              const rankColor = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : 'text-amber-500';
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';

              return (
                <button
                  key={artist.name}
                  onClick={() => playSongFromList(artist.songs[0], artist.songs)}
                  className={cn(
                    'group flex flex-1 flex-col items-center gap-2 rounded-2xl border bg-gradient-to-b p-3 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                    podiumBg
                  )}
                >
                  <div className="relative">
                    <div className="h-16 w-16 overflow-hidden rounded-full bg-muted ring-2 ring-white/10 group-hover:ring-white/20 transition-all duration-200">
                      {cover ? (
                        <CachedImage src={cover} alt={artist.name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Mic2 className="h-7 w-7 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/25 transition-all duration-200">
                      <Play className="h-5 w-5 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </div>
                  <p className="text-base">{medal}</p>
                  <div className="w-full min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{artist.name}</p>
                    <p className={cn('text-[10px] font-semibold', rankColor)}>
                      {artist.totalPlays.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-[9px] text-muted-foreground">écoutes</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* #4 → #10 liste compacte */}
          <div className="space-y-1.5">
            {topArtists.slice(3).map((artist, i) => {
              const coverSong = artist.songs.find((s) => s.cover_url) ?? artist.songs[0];
              const cover = coverSong ? songCoverUrl(coverSong) : null;
              return (
                <button
                  key={artist.name}
                  onClick={() => playSongFromList(artist.songs[0], artist.songs)}
                  className="group flex w-full items-center gap-3 rounded-xl bg-card/40 px-3 py-2.5 transition-colors hover:bg-card/70 active:scale-[0.99]"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                    {i + 4}
                  </span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {cover ? (
                      <CachedImage src={cover} alt={artist.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Mic2 className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-foreground">{artist.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {artist.totalPlays.toLocaleString('fr-FR')} écoutes · {artist.songs.length} titres
                    </p>
                  </div>
                  <Play className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </section>
      )}
      </div>

      {/* Réécouter — sélection aléatoire parmi les sons déjà écoutés (chargée à l'approche) */}
      <div ref={replayLazy.ref} aria-hidden />
      {!selectedGenre && replaySongs.length > 0 && (
        <section className="relative mb-8 animate-fade-slide-up" style={{ animationDelay: '0.28s' }}>
          <div className="px-4">
            <SectionHeader icon={History} title="Réécouter" />
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 scrollbar-hide">
            {replaySongs.map((s) => (
              <button
                key={s.id}
                onClick={() => playSongFromList(s, replaySongs)}
                className="group w-28 flex-shrink-0 snap-start text-left"
              >
                <div className="relative mb-1.5 aspect-square w-28 overflow-hidden rounded-xl">
                  <CachedImage src={songCoverUrl(s)} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                    <Play className="h-7 w-7 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                </div>
                <p className="truncate text-xs font-semibold text-foreground">{s.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">{s.author}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Découverte — masquée quand un genre est filtré (la grille filtrée est déjà au-dessus) */}
      {!selectedGenre && (
        <section className="relative px-4 animate-fade-slide-up" style={{ animationDelay: '0.3s' }}>
          <SectionHeader icon={Clock} title="Nouveautés" />
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="aspect-square animate-pulse rounded-2xl bg-secondary" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 py-12 text-center backdrop-blur-xl">
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
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {songs.slice(0, visibleCount).map((s, i) => (
                  <SongCard key={s.id} song={s} index={i} onPlay={() => playSongFromList(s, songs)} />
                ))}
              </div>
              {songs.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((c) => c + DISCOVER_PAGE)}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card/60 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  Voir plus ({songs.length - visibleCount} restants)
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </section>
      )}

      <TutorialModal open={tutorialOpen} onClose={closeTutorial} />
    </div>
  );
}
