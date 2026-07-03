import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, Heart, ListMusic, Users, Timer, Infinity as InfinityIcon, Music2, Square, Gauge, Car, ChevronLeft } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PlaybackRateControl from '@/components/PlaybackRateControl';
import type { Playlist, Song } from '@/types/music';

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.title || '', author: r.author || '', audio: r.audio || '',
    cover: r.cover || null, audio_url: r.audio_url || '', cover_url: r.cover_url || null,
    video_url: r.video_url || null, genre: r.genre || null, uploaded_by: r.uploaded_by || '',
    duration: r.duration || 0, play_count: r.play_count ?? 0, weekly_play_count: r.weekly_play_count ?? 0,
    likes_count: r.likes_count ?? 0, created_at: r.created, updated_at: r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

function recordToPlaylist(r: any): Playlist {
  return {
    id: r.id, title: r.title, description: r.description, is_public: r.is_public,
    owner_id: r.owner_id, view_count: r.view_count, play_count: r.play_count,
    likes_count: r.likes_count, thumbnail_mode: r.thumbnail_mode,
    created_at: r.created, updated_at: r.updated,
  } as Playlist;
}

function formatPlaylistDuration(sec: number): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} h ${String(rm).padStart(2, '0')}` : `${h} h`;
}

interface CarPlaylist {
  playlist: Playlist;
  songIds: string[];
  durationSec: number;
  shared: boolean;
}

interface GenreSession {
  genre: string;
  endAt: number | null; // null = infini
}

const DURATION_CHOICES: { label: string; minutes: number | null }[] = [
  { label: '10 min', minutes: 10 },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '∞', minutes: null },
];

export default function CarMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentSong, isPlaying, togglePlay, next, previous, refreshSongStats, playSongFromList, stopAudio, playbackRate } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [view, setView] = useState<'player' | 'browse'>(() => 'browse');
  const [tempoOpen, setTempoOpen] = useState(false);

  const [playlists, setPlaylists] = useState<CarPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [songMap, setSongMap] = useState<Map<string, Song>>(new Map());

  const [genres, setGenres] = useState<{ name: string; count: number }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreSession, setGenreSession] = useState<GenreSession | null>(null);
  const [remainingLabel, setRemainingLabel] = useState<string | null>(null);
  const [startingGenre, setStartingGenre] = useState(false);

  // Id du titre qui jouait quand la limite a été dépassée — on le laisse finir
  const deadlineSongIdRef = useRef<string | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  useEffect(() => { currentSongIdRef.current = currentSong?.id ?? null; }, [currentSong]);

  // Plein écran natif à l'entrée du mode voiture, restauré à la sortie
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  // À l'arrivée : si un titre joue déjà, aller direct sur le lecteur
  useEffect(() => {
    if (currentSong && isPlaying) setView('player');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plus de titre → retour à l'accueil du mode
  useEffect(() => { if (!currentSong) setView('browse'); }, [currentSong]);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  useEffect(() => {
    if (!user || !currentSong) { setLiked(false); return; }
    pbGetFirst('song_likes', `song_id = "${currentSong.id}" && user_id = "${user.id}"`).then((r) => setLiked(!!r));
  }, [user, currentSong]);

  // ── Chargement des playlists (miennes + partagées avec moi) avec durées ────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setPlaylistsLoading(true);
      try {
        const [mine, collabs] = await Promise.all([
          pb.collection('playlists').getList(1, 50, { filter: `owner_id = "${user.id}"`, sort: '-created', requestKey: null }),
          pb.collection('playlist_collaborators').getList(1, 50, { filter: `user_id = "${user.id}"`, requestKey: null }).catch(() => ({ items: [] as any[] })),
        ]);
        const mineList = mine.items.map(recordToPlaylist);
        const mineIds = new Set(mineList.map((p) => p.id));

        // Playlists où je suis collaborateur (partagées avec moi)
        const sharedIds = (collabs.items as any[]).map((r) => r.playlist_id).filter((id: string) => id && !mineIds.has(id));
        let sharedList: Playlist[] = [];
        if (sharedIds.length > 0) {
          const filters = sharedIds.map((id: string) => `id = "${id}"`).join(' || ');
          const res = await pb.collection('playlists').getList(1, 50, { filter: filters, requestKey: null });
          sharedList = res.items.map(recordToPlaylist);
        }

        const all = [
          ...mineList.map((p) => ({ playlist: p, shared: false })),
          ...sharedList.map((p) => ({ playlist: p, shared: true })),
        ];
        if (all.length === 0) { setPlaylists([]); setPlaylistsLoading(false); return; }

        // Tous les playlist_songs en un minimum de requêtes
        const plIds = all.map((e) => e.playlist.id);
        const psItems: any[] = [];
        for (let i = 0; i < plIds.length; i += 30) {
          const batch = plIds.slice(i, i + 30);
          const filter = batch.map((id) => `playlist_id = "${id}"`).join(' || ');
          const res = await pb.collection('playlist_songs').getList(1, 500, { filter, sort: 'position', requestKey: null });
          psItems.push(...res.items);
        }

        // Récupérer les chansons pour connaître les durées
        const songIds = [...new Set(psItems.map((r) => r.song_id).filter(Boolean))];
        const map = new Map<string, Song>();
        for (let i = 0; i < songIds.length; i += 50) {
          const batch = songIds.slice(i, i + 50);
          const filter = batch.map((id) => `id = "${id}"`).join(' || ');
          const res = await pb.collection('songs').getList(1, 50, { filter, requestKey: null });
          res.items.forEach((r: any) => map.set(r.id, recordToSong(r)));
        }
        setSongMap(map);

        setPlaylists(all.map(({ playlist, shared }) => {
          const ids = psItems.filter((r) => r.playlist_id === playlist.id).map((r) => r.song_id).filter((id: string) => map.has(id));
          const durationSec = ids.reduce((sum: number, id: string) => sum + (map.get(id)?.duration ?? 0), 0);
          return { playlist, songIds: ids, durationSec, shared };
        }));
      } catch {} finally {
        setPlaylistsLoading(false);
      }
    })();
  }, [user]);

  // ── Genres disponibles (à partir des sons existants) ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await pb.collection('songs').getList(1, 500, { sort: '-play_count', requestKey: null });
        const counts = new Map<string, number>();
        res.items.forEach((r: any) => { if (r.genre) counts.set(r.genre, (counts.get(r.genre) ?? 0) + 1); });
        setGenres([...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
      } catch {}
    })();
  }, []);

  // ── Session par genre : tick pour la limite + estimation discrète ─────────
  useEffect(() => {
    if (!genreSession) { setRemainingLabel(null); deadlineSongIdRef.current = null; return; }
    if (genreSession.endAt === null) { setRemainingLabel(null); return; }
    const tick = () => {
      const ms = genreSession.endAt! - Date.now();
      if (ms <= 0) {
        // Limite dépassée : on laisse le titre en cours se terminer
        if (deadlineSongIdRef.current === null) {
          if (!currentSongIdRef.current) {
            // Rien ne joue : on termine tout de suite
            setGenreSession(null);
            toast('Session terminée', { position: 'bottom-center' });
            return;
          }
          deadlineSongIdRef.current = currentSongIdRef.current;
        }
        setRemainingLabel('Dernier titre');
      } else {
        // Estimation volontairement floue, arrondie aux 5 minutes
        const approxMin = Math.max(5, Math.ceil(ms / 60000 / 5) * 5);
        setRemainingLabel(`≈ ${approxMin} min`);
      }
    };
    tick();
    const iv = setInterval(tick, 15000);
    return () => clearInterval(iv);
  }, [genreSession]);

  // Quand le titre change après la limite → stop
  useEffect(() => {
    if (!genreSession || deadlineSongIdRef.current === null) return;
    if (currentSong && currentSong.id !== deadlineSongIdRef.current) {
      stopAudio();
      setGenreSession(null);
      deadlineSongIdRef.current = null;
      toast('Session terminée — bonne route 🚗', { position: 'bottom-center' });
    }
  }, [currentSong?.id, genreSession, stopAudio, currentSong]);

  const startGenreSession = async (genre: string, minutes: number | null) => {
    setStartingGenre(true);
    try {
      const res = await pb.collection('songs').getList(1, 200, { filter: `genre = "${genre}"`, sort: '-play_count', requestKey: null });
      const songs = res.items.map(recordToSong);
      if (songs.length === 0) { toast.error('Aucun son dans ce genre', { position: 'bottom-center' }); return; }
      // Mélange pour varier les trajets
      for (let i = songs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [songs[i], songs[j]] = [songs[j], songs[i]]; }
      deadlineSongIdRef.current = null;
      playSongFromList(songs[0], songs);
      setGenreSession({ genre, endAt: minutes !== null ? Date.now() + minutes * 60 * 1000 : null });
      setSelectedGenre(null);
      setView('player');
    } catch {
      toast.error('Impossible de lancer la session', { position: 'bottom-center' });
    } finally {
      setStartingGenre(false);
    }
  };

  const stopGenreSession = () => {
    setGenreSession(null);
    deadlineSongIdRef.current = null;
  };

  const playPlaylist = (entry: CarPlaylist) => {
    const songs = entry.songIds.map((id) => songMap.get(id)).filter(Boolean) as Song[];
    if (songs.length === 0) { toast.error('Playlist vide', { position: 'bottom-center' }); return; }
    if (genreSession) stopGenreSession();
    playSongFromList(songs[0], songs);
    setView('player');
  };

  const toggleLike = async () => {
    if (!user || !currentSong) return;
    try {
      if (liked) {
        const likeRecord = await pbGetFirst('song_likes', `song_id = "${currentSong.id}" && user_id = "${user.id}"`);
        if (likeRecord) await pb.collection('song_likes').delete(likeRecord.id);
        setLiked(false);
        refreshSongStats(currentSong.id);
        toast('Like retiré', { description: currentSong.title, position: 'bottom-center' });
      } else {
        await pb.collection('song_likes').create({ song_id: currentSong.id, user_id: user.id });
        setLiked(true);
        refreshSongStats(currentSong.id);
        toast.success('Ajouté aux titres likés', { description: currentSong.title, position: 'bottom-center' });
      }
    } catch { toast.error("Impossible de modifier le like", { position: 'bottom-center' }); }
  };

  // ══════════════════════ VUE LECTEUR — plein écran, sans distraction ══════════════════════
  if (view === 'player' && currentSong) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        <div className="absolute inset-0 bg-gradient-hero opacity-40" />

        {/* Header minimal */}
        <div className="relative flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
          <button onClick={() => setView('browse')} className="flex h-12 items-center gap-1.5 rounded-full bg-secondary/70 pl-3 pr-5 font-semibold text-muted-foreground">
            <ChevronLeft className="h-6 w-6" />Menu
          </button>
          {genreSession && (
            <span className="flex items-center gap-2 rounded-full bg-secondary/70 px-4 py-2 text-sm font-semibold text-muted-foreground">
              <Timer className="h-4 w-4" />
              {genreSession.genre}{genreSession.endAt === null ? ' · ∞' : remainingLabel ? ` · ${remainingLabel}` : ''}
            </span>
          )}
          <button onClick={() => navigate(-1)} className="rounded-full bg-secondary/70 p-3"><X className="h-6 w-6" /></button>
        </div>

        {/* Cover + infos + commandes — s'adapte portrait/paysage */}
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-evenly gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] landscape:flex-row landscape:justify-center landscape:gap-[6vw]">
          <div className="aspect-square h-auto w-[min(78vw,42vh)] shrink-0 overflow-hidden rounded-[2rem] shadow-2xl landscape:w-[min(38vw,62vh)]">
            <img src={songCoverUrl(currentSong)} alt={currentSong.title} className="h-full w-full object-cover" />
          </div>

          <div className="flex min-w-0 flex-col items-center gap-[3vh] landscape:max-w-[46vw]">
            <div className="w-full text-center">
              <h2 className="truncate text-[clamp(1.75rem,5vmin,3rem)] font-extrabold leading-tight text-foreground">{currentSong.title}</h2>
              <p className="truncate text-[clamp(1.1rem,3vmin,1.75rem)] text-muted-foreground">{currentSong.author}</p>
            </div>

            <div className="flex items-center gap-[4vmin]">
              <button onClick={() => setTempoOpen((o) => !o)} className={cn('flex flex-col items-center transition-colors', tempoOpen || playbackRate !== 1 ? 'text-primary' : 'text-muted-foreground')}>
                <Gauge className="mb-1 h-[clamp(2rem,5vmin,2.75rem)] w-[clamp(2rem,5vmin,2.75rem)]" />
                <span className="text-sm font-semibold tabular-nums">{Math.round(playbackRate * 100)}%</span>
              </button>
              <button onClick={previous} className="p-3 text-foreground active:scale-90">
                <SkipBack className="h-[clamp(2.75rem,7vmin,4rem)] w-[clamp(2.75rem,7vmin,4rem)] fill-current" />
              </button>
              <button onClick={togglePlay} className="flex h-[clamp(6rem,16vmin,8.5rem)] w-[clamp(6rem,16vmin,8.5rem)] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl active:scale-95">
                {isPlaying
                  ? <Pause className="h-[45%] w-[45%] fill-current" />
                  : <Play className="ml-[6%] h-[45%] w-[45%] fill-current" />}
              </button>
              <button onClick={next} className="p-3 text-foreground active:scale-90">
                <SkipForward className="h-[clamp(2.75rem,7vmin,4rem)] w-[clamp(2.75rem,7vmin,4rem)] fill-current" />
              </button>
              <button onClick={toggleLike} className={`flex flex-col items-center ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>
                <Heart className={`mb-1 h-[clamp(2rem,5vmin,2.75rem)] w-[clamp(2rem,5vmin,2.75rem)] ${liked ? 'fill-current' : ''}`} />
                <span className="text-sm font-semibold">{liked ? 'Liké' : 'Like'}</span>
              </button>
            </div>
          </div>
        </div>

        {tempoOpen && <PlaybackRateControl open={tempoOpen} onClose={() => setTempoOpen(false)} />}
      </div>
    );
  }

  // ══════════════════════ VUE ACCUEIL DU MODE — choix playlist / genre ══════════════════════
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-40" />

      <div className="relative flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-soft">
            <Car className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-wider text-foreground">Mode Voiture</h1>
            <p className="text-sm text-muted-foreground">Lance ta musique, garde les yeux sur la route</p>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary/70 p-3"><X className="h-6 w-6" /></button>
      </div>

      <div className="relative flex-1 overflow-y-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-3xl">

          {/* Reprendre la lecture en cours */}
          {currentSong && (
            <button
              onClick={() => setView('player')}
              className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left transition-colors hover:bg-primary/15 active:scale-[0.99]"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl shadow-soft">
                <img src={songCoverUrl(currentSong)} alt={currentSong.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">{isPlaying ? 'En cours de lecture' : 'En pause'}</p>
                <p className="truncate text-lg font-bold">{currentSong.title}</p>
                <p className="truncate text-sm text-muted-foreground">{currentSong.author}</p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
              </div>
            </button>
          )}

          {/* Session par genre active */}
          {genreSession && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
                <Timer className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Session {genreSession.genre}</p>
                <p className="text-sm text-muted-foreground">
                  {genreSession.endAt === null ? 'Lecture en continu' : remainingLabel ?? 'En cours'}
                </p>
              </div>
              <button onClick={stopGenreSession} className="flex items-center gap-1.5 rounded-xl bg-secondary/80 px-4 py-2.5 text-sm font-semibold">
                <Square className="h-3.5 w-3.5" />Stop
              </button>
            </div>
          )}

          {/* ── Playlists ── */}
          <section className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
              <ListMusic className="h-6 w-6 text-primary" />Mes playlists
            </h3>
            {playlistsLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary/50" />
                ))}
              </div>
            ) : playlists.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-muted-foreground">
                Aucune playlist pour l'instant
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {playlists.map((entry) => {
                  const dur = formatPlaylistDuration(entry.durationSec);
                  return (
                    <button
                      key={entry.playlist.id}
                      onClick={() => playPlaylist(entry)}
                      className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 text-left transition-colors hover:bg-card active:scale-[0.99]"
                    >
                      <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-xl shadow-soft', entry.shared ? 'bg-gradient-to-br from-sky-500 to-indigo-500' : 'bg-gradient-primary')}>
                        {entry.shared ? <Users className="h-7 w-7 text-white" /> : <ListMusic className="h-7 w-7 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold">{entry.playlist.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {entry.shared && 'Partagée · '}
                          {entry.songIds.length} {entry.songIds.length === 1 ? 'titre' : 'titres'}
                          {dur && ` · ${dur}`}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Play className="ml-0.5 h-5 w-5 fill-current" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Session par genre ── */}
          <section className="mt-8 pb-4">
            <h3 className="mb-1 flex items-center gap-2 text-xl font-bold text-foreground">
              <Timer className="h-6 w-6 text-primary" />Session par genre
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">Choisis un genre et une durée, la musique s'arrête toute seule.</p>

            {selectedGenre ? (
              <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xl font-bold">{selectedGenre}</p>
                  <button onClick={() => setSelectedGenre(null)} className="rounded-xl bg-secondary/70 px-4 py-2 text-sm font-semibold text-muted-foreground">Changer</button>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">Pendant combien de temps ?</p>
                <div className="grid grid-cols-4 gap-3">
                  {DURATION_CHOICES.map((c) => (
                    <button
                      key={c.label}
                      disabled={startingGenre}
                      onClick={() => startGenreSession(selectedGenre, c.minutes)}
                      className="flex h-20 flex-col items-center justify-center rounded-xl border border-border/50 bg-secondary/60 font-bold transition-colors hover:border-primary/60 hover:bg-primary/10 active:scale-[0.97] disabled:opacity-50"
                    >
                      {c.minutes === null ? <InfinityIcon className="h-7 w-7" /> : <span className="text-xl">{c.label}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : genres.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-muted-foreground">
                Aucun genre disponible
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {genres.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => setSelectedGenre(g.name)}
                    className="flex h-20 items-center justify-between rounded-xl border border-border/50 bg-card/60 px-4 transition-colors hover:border-primary/60 hover:bg-primary/10 active:scale-[0.97]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Music2 className="h-5 w-5 shrink-0 text-primary" />
                      <span className="truncate text-lg font-bold">{g.name}</span>
                    </span>
                    <span className="ml-2 shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">{g.count}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
