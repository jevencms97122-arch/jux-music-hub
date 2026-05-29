import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { songAudioUrl, songCoverUrl } from '@/lib/storage';
import { extractDominantHsl, applyAccentHsl } from '@/lib/dominantColor';
import { updateStreak } from '@/lib/streaks';
import { setMediaSessionMetadata, setMediaSessionHandlers, setMediaSessionPosition, setMediaSessionPlaybackState, clearMediaSession } from '@/lib/notifications';
import { sendNowPlayingToNative, clearNowPlayingOnNative, onNativeCommand, resolveCoverUrl } from '@/lib/androidMediaBridge';
import type { NativeCommandEvent } from '@/lib/androidMediaBridge';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import type { Song } from '@/types/music';

export interface ListenSessionRow {
  id: string;
  code: string | null;
  host_id: string;
  song_id: string | null;
  is_playing: boolean;
  current_time_seconds: number;
  participants: string[];
  ready_participants: string[];
  is_active: boolean;
}

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Song[];
  queueIndex: number;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isPlayerOpen: boolean;
  playbackRate: number;
  crossfadeSeconds: number;
  // Session
  activeSession: ListenSessionRow | null;
  isSessionHost: boolean;
  isSessionGuest: boolean;
  allParticipantsReady: boolean;
  refreshSession: () => Promise<void>;
  setActiveSession: (s: ListenSessionRow | null) => void;
  stopAudio: () => void;
  refreshSongStats: (songId: string) => Promise<void>;

  playSong: (song: Song) => void;
  playSongFromList: (song: Song, list: Song[]) => void;
  /**
   * Lecture d'un audio "externe" (hors Supabase), sans incrémenter play_count/weekly stats.
   * Utilisé par la section YouTube Trends / Piped.
   */
  playExternalAudio: (payload: {
    videoId: string;
    title: string;
    author: string;
    coverUrl: string;
    audioUrl: string;
  }) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  openPlayer: () => void;
  closePlayer: () => void;
  setPlaybackRate: (r: number) => void;
  setCrossfadeSeconds: (s: number) => void;
  addToQueue: (song: Song) => void;
  startRadio: (seed: Song) => Promise<void>;
  // Video synchronisation
  signalVideoReady: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const CROSSFADE_KEY = 'jux:crossfade';

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { authUser } = useAuth();
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<'A' | 'B'>('A');
  const crossfadingRef = useRef(false);
  const crossfadeIntervalRef = useRef<number | null>(null);


  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [playedSongIds, setPlayedSongIds] = useState<Set<string>>(new Set());
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(CROSSFADE_KEY) || '3');
    return isNaN(v) ? 3 : Math.max(0, Math.min(12, v));
  });

  // === Video synchronisation ===
  // Not used for audio control anymore – audio plays immediately in loadAndPlay.
  // Kept only as a flag for SynchronizedVideoPlayer to know when to re-sync.
  const videoReadyRef = useRef(false);
  const signalVideoReady = useCallback(() => {
    videoReadyRef.current = true;
  }, []);

  // === Session ===
  const [activeSession, setActiveSessionState] = useState<ListenSessionRow | null>(null);
  const sessionRef = useRef<ListenSessionRow | null>(null);
  useEffect(() => { sessionRef.current = activeSession; }, [activeSession]);
  const isSessionHost = !!(activeSession && authUser && activeSession.host_id === authUser.id);
  const isSessionGuest = !!(activeSession && authUser && activeSession.host_id !== authUser.id);
  const allParticipantsReady = !!activeSession && activeSession.participants.every((p) => activeSession.ready_participants?.includes(p));

  const setActiveSession = useCallback((s: ListenSessionRow | null) => setActiveSessionState(s), []);

  const getActive = () => (activeRef.current === 'A' ? audioARef.current! : audioBRef.current!);
  const getInactive = () => (activeRef.current === 'A' ? audioBRef.current! : audioARef.current!);

  const nextRef = useRef<() => void>(() => {});
  const previousRef = useRef<() => void>(() => {});
  const togglePlayRef = useRef<() => void>(() => {});
  const seekRef = useRef<(t: number) => void>(() => {});
  const stopAudioRef = useRef<() => void>(() => {});
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const repeatModeRef = useRef(repeatMode);
  const isSessionGuestRef = useRef(isSessionGuest);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const isShuffledRef = useRef(isShuffled);
  const volumeRef = useRef(volume);
  const playbackRateRef = useRef(playbackRate);
  const pendingSessionAutoplayRef = useRef(false);
  const sessionGuestRecordedRef = useRef<string | null>(null);
  useEffect(() => { crossfadeSecondsRef.current = crossfadeSeconds; }, [crossfadeSeconds]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isSessionGuestRef.current = isSessionGuest; }, [isSessionGuest]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { isShuffledRef.current = isShuffled; }, [isShuffled]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  const recordPlayRef = useRef<(s: Song) => void>(() => {});
  const broadcastSongRef = useRef<(s: Song) => void>(() => {});

  const triggerCrossfadeRef = useRef<() => void>(() => {
    if (crossfadingRef.current) return;
    const fadeSec = crossfadeSecondsRef.current;
    if (fadeSec <= 0) return;
    if (isSessionGuestRef.current) return;

    // Determine next song
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;

    let nextIdx: number;
    if (repeatModeRef.current === 'one') {
      // No crossfade for repeat one — let onEnd handle restart
      return;
    } else if (isShuffledRef.current) {
      nextIdx = Math.floor(Math.random() * q.length);
    } else {
      nextIdx = idx + 1;
    }
    if (nextIdx >= q.length) {
      if (repeatModeRef.current === 'all') nextIdx = 0;
      else return; // No next, let normal flow handle
    }

    const nextSong = q[nextIdx];
    if (!nextSong) return;

    crossfadingRef.current = true;
    const active = getActive();
    const inactive = getInactive();

    inactive.src = songAudioUrl(nextSong);
    inactive.volume = 0;
    inactive.playbackRate = playbackRateRef.current;
    inactive.currentTime = 0;

    const startFade = () => {
      const startTs = performance.now();
      const fadeMs = fadeSec * 1000;
      const startVol = active.volume;
      const targetVol = volumeRef.current;

      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
      }
      crossfadeIntervalRef.current = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - startTs) / fadeMs);
        active.volume = Math.max(0, startVol * (1 - p));
        inactive.volume = Math.min(1, targetVol * p);
        if (p >= 1) {
          if (crossfadeIntervalRef.current) {
            clearInterval(crossfadeIntervalRef.current);
            crossfadeIntervalRef.current = null;
          }
          try { active.pause(); active.currentTime = 0; active.removeAttribute('src'); active.load(); } catch {}
          activeRef.current = activeRef.current === 'A' ? 'B' : 'A';
          inactive.volume = targetVol;
          // Mettre à jour la durée et le temps avec ceux du NOUVEAU son actifs
          setDuration(inactive.duration || 0);
          setCurrentTime(inactive.currentTime || 0);
          setQueueIndex(nextIdx);
          setCurrentSong(nextSong);
          setPlayedSongIds(prev => new Set([...prev, nextSong.id]));
          setIsPlaying(true);
          recordPlayRef.current(nextSong);
          if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) {
            broadcastSongRef.current(nextSong);
          }
          crossfadingRef.current = false;
        }
      }, 50) as unknown as number;
    };

    const onReady = () => {
      inactive.removeEventListener('canplay', onReady);
      inactive.play().then(startFade).catch((e) => {
        console.error('Crossfade play failed', e);
        crossfadingRef.current = false;
      });
    };
    inactive.addEventListener('canplay', onReady);
    inactive.load();
  });


  // Init audio elements
  useEffect(() => {
    const create = () => {
      const a = new Audio();
      a.preload = 'auto';
      (a as any).preservesPitch = false;
      (a as any).mozPreservesPitch = false;
      (a as any).webkitPreservesPitch = false;
      a.crossOrigin = 'anonymous';
      return a;
    };
    audioARef.current = create();
    audioBRef.current = create();

    const onTime = (e: Event) => {
      const a = getActive();
      // Only react to active audio's timeupdate
      if (e.target !== a) return;
      setCurrentTime(a.currentTime);

      const dur = a.duration;
      if (!isFinite(dur) || dur <= 0) return;

      const fadeDuration = crossfadeSecondsRef.current;
      const remaining = dur - a.currentTime;

      if (
        fadeDuration > 0 &&
        remaining <= fadeDuration &&
        remaining > 0.1 &&
        !crossfadingRef.current &&
        !isSessionGuestRef.current &&
        repeatModeRef.current !== 'one'
      ) {
        triggerCrossfadeRef.current();
      }
    };

    const onDur = (e: Event) => {
      if (e.target === getActive()) setDuration(getActive().duration || 0);
    };
    const onEnd = (e: Event) => {
      if (e.target !== getActive()) return;
      if (crossfadingRef.current) return;
      if (isSessionGuestRef.current) return;
      nextRef.current();
    };

    const onPlay = (e: Event) => { if (e.target === getActive()) setIsPlaying(true); };
    const onPause = (e: Event) => {
      if (e.target !== getActive()) return;
      if (!crossfadingRef.current) setIsPlaying(false);
    };

    [audioARef.current, audioBRef.current].forEach((a) => {
      a.addEventListener('timeupdate', onTime);
      a.addEventListener('loadedmetadata', onDur);
      a.addEventListener('ended', onEnd);
      a.addEventListener('play', onPlay);
      a.addEventListener('pause', onPause);
    });

    return () => {
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
        crossfadeIntervalRef.current = null;
      }
      crossfadingRef.current = false;
      [audioARef.current, audioBRef.current].forEach((a) => {
        if (!a) return;
        a.pause();
        a.removeEventListener('timeupdate', onTime);
        a.removeEventListener('loadedmetadata', onDur);
        a.removeEventListener('ended', onEnd);
        a.removeEventListener('play', onPlay);
        a.removeEventListener('pause', onPause);
      });
      clearMediaSession();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = getActive();
    if (a) a.volume = volume;
    // Don't touch inactive audio during crossfade
  }, [volume]);
  useEffect(() => {
    [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.playbackRate = playbackRate; });
  }, [playbackRate]);

  // ── Pont Android : envoyer les infos NowPlaying au natif ──────
  useEffect(() => {
    if (!currentSong) {
      clearNowPlayingOnNative();
      return;
    }

    const coverUrl = resolveCoverUrl(songCoverUrl(currentSong));

    sendNowPlayingToNative({
      songId: currentSong.id,
      title: currentSong.title || 'Sans titre',
      author: currentSong.author || 'Inconnu',
      coverUrl,
      duration,
      currentTime,
      isPlaying,
      playbackRate,
      volume,
      repeatMode,
      isShuffled,
    });
  }, [currentSong, isPlaying, currentTime, duration, playbackRate, volume, repeatMode, isShuffled]);

  // ── Pont Android : écouter les commandes venant du natif ──────
  // Utilise les refs pour toujours avoir les dernières versions des fonctions
  useEffect(() => {
    const unsubscribe = onNativeCommand((event: NativeCommandEvent) => {
      switch (event.command) {
        case 'play':
          getActive()?.play().catch(console.error);
          break;
        case 'pause':
          getActive()?.pause();
          break;
        case 'togglePlay':
        case 'play_pause':      // envoyé par l'app Android
          togglePlayRef.current();
          break;
        case 'next':            // envoyé par l'app Android
          nextRef.current();
          break;
        case 'previous':
        case 'prev':            // envoyé par l'app Android
          previousRef.current();
          break;
        case 'seek':
          if (event.seekTime != null) seekRef.current(event.seekTime);
          break;
        case 'stop':
          stopAudioRef.current();
          break;
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setMediaSessionMetadata(currentSong); }, [currentSong]);
  useEffect(() => { setMediaSessionPlaybackState(currentSong ? (isPlaying ? 'playing' : 'paused') : 'none'); }, [isPlaying, currentSong]);

  // Adapter l'accent de couleur à la cover du morceau en cours
  // Ne s'applique que si dynamicColorEnabled est true (depuis ThemeContext)
  const { dynamicColorEnabled } = useTheme();
  useEffect(() => {
    if (!currentSong) { applyAccentHsl(null); return; }
    if (!dynamicColorEnabled) { applyAccentHsl(null); return; }
    let cancelled = false;
    extractDominantHsl(songCoverUrl(currentSong)).then((hsl) => {
      if (!cancelled) applyAccentHsl(hsl);
    });
    return () => { cancelled = true; };
  }, [currentSong, dynamicColorEnabled]);
  useEffect(() => {
    setMediaSessionHandlers({
      play: () => getActive()?.play(),
      pause: () => getActive()?.pause(),
      next: () => next(),
      previous: () => previous(),
      seek: (t) => seek(t),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, queueIndex, repeatMode, isShuffled]);
  useEffect(() => {
    setMediaSessionPosition(duration, currentTime, playbackRate);
  }, [duration, currentTime, playbackRate]);

  const setCrossfadeSeconds = useCallback((s: number) => {
    const v = s <= 0 ? 0 : Math.max(1, Math.min(12, s));
    setCrossfadeSecondsState(v);
    localStorage.setItem(CROSSFADE_KEY, String(v));
    crossfadeSecondsRef.current = v;
  }, []);


  const refreshSongStats = useCallback(async (songId: string) => {
    const { data } = await supabase
      .from('songs')
      .select('play_count, likes_count')
      .eq('id', songId)
      .maybeSingle();
    if (!data) return;
    setCurrentSong((cur) => cur?.id === songId ? { ...cur, ...data } : cur);
    setQueue((q) => q.map((s) => s.id === songId ? { ...s, ...data } : s));
  }, []);

  const countedWeeklyRef = useRef<Set<string>>(new Set());
  const weeklyListenStartRef = useRef<Map<string, number>>(new Map());

  const recordPlay = useCallback((song: Song) => {
    if (!authUser) return;
    supabase.from('listen_history').insert({ user_id: authUser.id, song_id: song.id }).then(() => {});
    updateStreak(authUser.id);
    // Incrémente le play_count immédiatement au lancement
    supabase.rpc('increment_song_play', { _song_id: song.id }).then(({ data }) => {
      if (typeof data === 'number') {
        const stats = { play_count: data };
        setCurrentSong((cur) => cur?.id === song.id ? { ...cur, ...stats } : cur);
        setQueue((q) => q.map((s) => s.id === song.id ? { ...s, ...stats } : s));
      } else {
        refreshSongStats(song.id);
      }
    });
    // Reset le compteur weekly pour cette session d'écoute
    weeklyListenStartRef.current.set(song.id, 0);
    countedWeeklyRef.current.delete(song.id);
  }, [authUser, refreshSongStats]);
  useEffect(() => { recordPlayRef.current = recordPlay; }, [recordPlay]);

  // Incrémente le weekly_play_count seulement après 30s d'écoute cumulée
  useEffect(() => {
    if (!currentSong || !authUser) return;
    const songId = currentSong.id;
    if (countedWeeklyRef.current.has(songId)) return;
    const prev = weeklyListenStartRef.current.get(songId) ?? 0;
    const reached = Math.max(prev, currentTime);
    weeklyListenStartRef.current.set(songId, reached);
    if (reached >= 30) {
      countedWeeklyRef.current.add(songId);
      supabase.rpc('increment_song_weekly_play', { _song_id: songId }).then(({ data }) => {
        if (typeof data === 'number') {
          const stats = { weekly_play_count: data };
          setCurrentSong((cur) => cur?.id === songId ? { ...cur, ...stats } : cur);
          setQueue((q) => q.map((s) => s.id === songId ? { ...s, ...stats } : s));
        } else {
          refreshSongStats(songId);
        }
      });
    }
  }, [currentTime, currentSong, authUser, refreshSongStats]);


  const stopAudio = useCallback(() => {
    [audioARef.current, audioBRef.current].forEach((a) => {
      if (!a) return;
      try { a.pause(); a.currentTime = 0; } catch {}
    });
    setIsPlaying(false);
  }, []);

  const loadAndPlay = useCallback(async (song: Song, autoPlay = true) => {
    // Cancel any ongoing crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    crossfadingRef.current = false;
    // Stop the inactive audio if it was preloading a crossfade
    const inactive = getInactive();
    if (inactive) {
      try { inactive.pause(); inactive.volume = 0; inactive.removeAttribute('src'); inactive.load(); } catch {}
    }
    const a = getActive();
    if (!a) return;
    a.src = songAudioUrl(song);
    a.volume = volume;
    // Force playbackRate après changement de src (certains navigateurs reset à 1)
    const applyRate = () => { a.playbackRate = playbackRate; };
    applyRate();
    a.addEventListener('loadedmetadata', applyRate, { once: true });
    a.addEventListener('playing', applyRate, { once: true });
    // Si host de session : ne pas démarrer tout de suite, attendre que tous soient prêts
    const inSessionAsHost = !!(sessionRef.current && authUser && sessionRef.current.host_id === authUser.id);
    if (!autoPlay || inSessionAsHost) {
      pendingSessionAutoplayRef.current = !!inSessionAsHost;
      a.load();
      return;
    }
    // Jouer l'audio immédiatement, même avec vidéo YouTube
    // La vidéo se synchronisera via currentTime et isPlaying
    try {
      await a.play();
      a.playbackRate = playbackRate;
      recordPlay(song);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, [playbackRate, volume, recordPlay, authUser]);

  const loadAndPlayExternalAudio = useCallback(async (payload: {
    videoId: string;
    title: string;
    author: string;
    coverUrl: string;
    audioUrl: string;
    autoPlay?: boolean;
  }) => {
    // Cancel any ongoing crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    crossfadingRef.current = false;

    const inactive = getInactive();
    if (inactive) {
      try { inactive.pause(); inactive.volume = 0; inactive.removeAttribute('src'); inactive.load(); } catch {}
    }

    const a = getActive();
    if (!a) return;

    // Build a Song-compatible object so the UI (current title/cover) keeps working.
    // IMPORTANT: we do NOT rely on audio_url from Supabase.
    const externalSong: Song = {
      id: `external:${payload.videoId}`,
      title: payload.title,
      author: payload.author,
      audio_url: '',
      cover_url: payload.coverUrl ?? null,
      video_url: payload.videoId ? `external-video:${payload.videoId}` : null,
      genre: null,
      uploaded_by: authUser?.id ?? 'external',
      play_count: 0,
      weekly_play_count: 0,
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCurrentSong(externalSong);
    setQueue([externalSong]);
    setQueueIndex(0);

    a.src = payload.audioUrl;
    a.volume = volume;

    const applyRate = () => { a.playbackRate = playbackRate; };
    applyRate();
    a.addEventListener('loadedmetadata', applyRate, { once: true });
    a.addEventListener('playing', applyRate, { once: true });

    const inSessionAsHost = !!(sessionRef.current && authUser && sessionRef.current.host_id === authUser.id);
    const shouldAutoPlay = payload.autoPlay ?? true;

    if (!shouldAutoPlay || inSessionAsHost) {
      pendingSessionAutoplayRef.current = !!inSessionAsHost;
      a.load();
      return;
    }

    try {
      await a.play();
      a.playbackRate = playbackRate;
      // No recordPlay(): external items should not increment stats (play_count / weekly_play_count).
    } catch (e) {
      console.error('External audio play failed', e);
    }
  }, [playbackRate, volume, authUser]);

    // Crossfade removed - simple next


  // === Broadcast helper (host) ===
  const broadcastSong = useCallback(async (song: Song) => {
    const s = sessionRef.current;
    if (!s || !authUser || s.host_id !== authUser.id) return;
    await supabase.from('listen_sessions').update({
      song_id: song.id,
      current_time_seconds: 0,
      is_playing: false, // démarrera quand tous prêts
      ready_participants: [authUser.id],
      updated_at: new Date().toISOString(),
    }).eq('id', s.id);
  }, [authUser]);
  useEffect(() => { broadcastSongRef.current = broadcastSong; }, [broadcastSong]);


  const playSong = useCallback((song: Song) => {
    // Invité : ne peut pas changer
    if (isSessionGuestRef.current) {
      toast.info("Seul l'hôte peut changer la musique de la session");
      return;
    }
    setCurrentSong(song);
    setQueue([song]);
    setQueueIndex(0);
    setPlayedSongIds(new Set([song.id]));
    setIsPlayerOpen(true);
    loadAndPlay(song);

    // Si host de session → broadcast auto
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) {
      broadcastSong(song);
    }

    // Auto-queue likes
    if (authUser) {
      (async () => {
        const { data: likeRow } = await supabase
          .from('song_likes').select('id')
          .eq('user_id', authUser.id).eq('song_id', song.id).maybeSingle();
        if (!likeRow) return;
        const { data: allLikes } = await supabase
          .from('song_likes').select('song_id').eq('user_id', authUser.id);
        const otherIds = (allLikes ?? []).map((l) => l.song_id).filter((id) => id !== song.id);
        if (otherIds.length === 0) return;
        const { data: songsData } = await supabase.from('songs').select('*').in('id', otherIds);
        const others = (songsData ?? []) as Song[];
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        setQueue((q) => (q.length === 1 && q[0].id === song.id ? [song, ...others] : q));
      })();
    }
  }, [loadAndPlay, authUser, broadcastSong]);

  const playSongFromList = useCallback((song: Song, list: Song[]) => {
    if (isSessionGuestRef.current) {
      toast.info("Seul l'hôte peut changer la musique de la session");
      return;
    }
    const idx = Math.max(0, list.findIndex((s) => s.id === song.id));
    setQueue(list);
    setQueueIndex(idx);
    setCurrentSong(song);
    setPlayedSongIds(new Set([song.id]));
    setIsPlayerOpen(true);
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) {
      broadcastSong(song);
    }
  }, [loadAndPlay, authUser, broadcastSong]);

  const togglePlay = useCallback(() => {
    const a = getActive();
    if (!a || !currentSong) return;
    // Invité : redirige vers session
    if (isSessionGuestRef.current) {
      toast.info("Seul l'hôte peut contrôler la lecture");
      return;
    }
    const shouldPlay = a.paused;
    pendingSessionAutoplayRef.current = false;
    if (shouldPlay) a.play().catch(console.error);
    else a.pause();
    // Host : broadcast play/pause
    const s = sessionRef.current;
    if (s && authUser && s.host_id === authUser.id) {
      supabase.from('listen_sessions').update({
        is_playing: shouldPlay,
        current_time_seconds: a.currentTime,
      }).eq('id', s.id).then(() => {});
    }
  }, [currentSong, authUser]);

  const findRecommendedSongs = useCallback(async (baseSong: Song): Promise<Song[]> => {
    try {
      const { data } = await supabase.from('songs').select('*').limit(500);
      const all = (data ?? []) as Song[];
      const queueIds = new Set(queue.map((s) => s.id));
      const filtered = all.filter((s) => !playedSongIds.has(s.id) && !queueIds.has(s.id) && s.id !== baseSong.id);
      const sameGenre = filtered.filter((s) => s.genre && s.genre === baseSong.genre)
        .sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));
      if (sameGenre.length > 0) return sameGenre.slice(0, 20);
      return filtered.sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0)).slice(0, 20);
    } catch (err) {
      console.error('Reco error:', err);
      return [];
    }
  }, [playedSongIds, queue]);

  const playAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= queue.length) return;
    const song = queue[idx];
    setQueueIndex(idx);
    setCurrentSong(song);
    setPlayedSongIds((prev) => new Set([...prev, song.id]));
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) {
      broadcastSong(song);
    }
  }, [queue, loadAndPlay, authUser, broadcastSong]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (repeatMode === 'one') { playAtIndex(queueIndex); return; }
    const nextIdx = isShuffled ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') { playAtIndex(0); return; }
      if (currentSong) {
        findRecommendedSongs(currentSong).then((rec) => {
          if (rec.length > 0) {
            const song = rec[0];
            const len = queue.length;
            setCurrentSong(song);
            setQueue((q) => [...q, ...rec]);
            setQueueIndex(len);
            setPlayedSongIds((p) => new Set([...p, song.id]));
            loadAndPlay(song);
            if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) {
              broadcastSong(song);
            }
          } else {
            getActive()?.pause();
          }
        });
      } else {
        getActive()?.pause();
      }
    } else {
      playAtIndex(nextIdx);
    }
  }, [queue, queueIndex, repeatMode, isShuffled, playAtIndex, currentSong, findRecommendedSongs, loadAndPlay, authUser, broadcastSong]);

  const previous = useCallback(() => {
    const a = getActive();
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) playAtIndex(prevIdx);
  }, [queueIndex, playAtIndex]);

  const seek = useCallback((t: number) => {
    const a = getActive(); if (a) a.currentTime = t;
    const s = sessionRef.current;
    if (s && authUser && s.host_id === authUser.id) {
      supabase.from('listen_sessions').update({ current_time_seconds: t }).eq('id', s.id).then(() => {});
    }
  }, [authUser]);
  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleShuffle = useCallback(() => setIsShuffled((s) => !s), []);
  const cycleRepeat = useCallback(() => setRepeatMode((m) => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'), []);
  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
  const setPlaybackRate = useCallback((r: number) => setPlaybackRateState(Math.max(0.5, Math.min(2, r))), []);
  const addToQueue = useCallback((song: Song) => setQueue((q) => [...q, song]), []);

  // Synchroniser les refs avec les fonctions réelles pour le pont Android
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { previousRef.current = previous; }, [previous]);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { seekRef.current = seek; }, [seek]);
  useEffect(() => { stopAudioRef.current = stopAudio; }, [stopAudio]);

  const startRadio = useCallback(async (seed: Song) => {
    const rec = await findRecommendedSongs(seed);
    const list = [seed, ...rec];
    setQueue(list);
    setQueueIndex(0);
    setCurrentSong(seed);
    setPlayedSongIds(new Set([seed.id]));
    loadAndPlay(seed);
  }, [findRecommendedSongs, loadAndPlay]);

  // === Surveillance globale de la session active de l'utilisateur ===
  const refreshSession = useCallback(async () => {
    if (!authUser) { setActiveSessionState(null); return; }
    const { data: hosted } = await supabase.from('listen_sessions')
      .select('*').eq('host_id', authUser.id).eq('is_active', true).maybeSingle();
    if (hosted) { setActiveSessionState(hosted as ListenSessionRow); return; }
    const { data: joined } = await supabase.from('listen_sessions')
      .select('*').contains('participants', [authUser.id]).eq('is_active', true).limit(1);
    setActiveSessionState((joined?.[0] as ListenSessionRow) ?? null);
  }, [authUser]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Realtime sur toutes les sessions concernant l'utilisateur
  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel('user-sessions-' + authUser.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listen_sessions' }, (payload: any) => {
        const row = (payload.new ?? payload.old) as ListenSessionRow | undefined;
        if (!row) return;
        const concerns = row.host_id === authUser.id || row.participants?.includes(authUser.id);
        if (!concerns) return;
        if (payload.eventType === 'DELETE' || (payload.new && !(payload.new as ListenSessionRow).is_active)) {
          if (sessionRef.current?.id === row.id) setActiveSessionState(null);
          return;
        }
        // Filtre : ne mettre à jour que si c'est NOTRE session active (ou nouvelle)
        const cur = sessionRef.current;
        if (!cur || cur.id === row.id) {
          setActiveSessionState(payload.new as ListenSessionRow);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser]);

  // === GUEST: sync audio depuis la session ===
  // Charger la song de session
  const lastLoadedSessionSongRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSessionGuest || !activeSession || !authUser) return;
    if (!activeSession.song_id) return;
    if (lastLoadedSessionSongRef.current === activeSession.song_id) return;
    lastLoadedSessionSongRef.current = activeSession.song_id;
    (async () => {
      const { data } = await supabase.from('songs').select('*').eq('id', activeSession.song_id).maybeSingle();
      if (!data) return;
      const song = data as Song;
      sessionGuestRecordedRef.current = null;
      setCurrentSong(song);
      setQueue([song]);
      setQueueIndex(0);
      const a = getActive();
      a.src = songAudioUrl(song);
      a.playbackRate = playbackRate;
      a.volume = volume;
      a.load();
      // Marquer prêt quand chargé
      const onCanPlay = async () => {
        a.removeEventListener('canplaythrough', onCanPlay);
        const cur = sessionRef.current;
        if (!cur || !authUser) return;
        const ready = cur.ready_participants ?? [];
        if (!ready.includes(authUser.id)) {
          await supabase.from('listen_sessions')
            .update({ ready_participants: [...ready, authUser.id] })
            .eq('id', cur.id);
        }
      };
      a.addEventListener('canplaythrough', onCanPlay);
    })();
  }, [isSessionGuest, activeSession?.song_id, authUser, playbackRate, volume, activeSession]);

  // Sync play/pause + time pour guest
  useEffect(() => {
    if (!isSessionGuest || !activeSession) return;
    const a = getActive();
    if (!a || !a.src) return;
    if (Math.abs(a.currentTime - activeSession.current_time_seconds) > 1.5) {
      a.currentTime = activeSession.current_time_seconds;
    }
    if (activeSession.is_playing) {
      a.play().then(() => {
        if (currentSong && sessionGuestRecordedRef.current !== currentSong.id) {
          sessionGuestRecordedRef.current = currentSong.id;
          recordPlay(currentSong);
        }
      }).catch(console.error);
    } else {
      a.pause();
    }
  }, [isSessionGuest, activeSession?.is_playing, activeSession?.current_time_seconds, activeSession, currentSong, recordPlay]);

  // === HOST: sync time toutes les 1s + démarrer quand tous prêts ===
  useEffect(() => {
    if (!isSessionHost || !activeSession) return;
    const interval = setInterval(() => {
      const a = getActive();
      if (!a || !sessionRef.current) return;
      const updates: any = {
        current_time_seconds: a.currentTime,
        updated_at: new Date().toISOString(),
      };
      // Sync pause immédiate ; ne relance jamais automatiquement une pause utilisateur.
      if (a.paused && sessionRef.current.is_playing) {
        updates.is_playing = false;
      }
      supabase.from('listen_sessions').update(updates).eq('id', sessionRef.current.id).then(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [isSessionHost, activeSession?.id, activeSession]);

  // HOST : quand tout le monde est prêt et qu'on a une song mais is_playing=false → lancer
  useEffect(() => {
    if (!isSessionHost || !activeSession?.song_id) return;
    if (activeSession.is_playing || !pendingSessionAutoplayRef.current) return;
    if (!allParticipantsReady) return;
    const a = getActive();
    if (a && a.paused) {
      a.play().then(() => {
        pendingSessionAutoplayRef.current = false;
        if (currentSong) recordPlay(currentSong);
        supabase.from('listen_sessions').update({
          is_playing: true,
          current_time_seconds: a.currentTime,
        }).eq('id', activeSession.id).then(() => {});
      }).catch(console.error);
    }
  }, [isSessionHost, allParticipantsReady, activeSession, currentSong, recordPlay]);

  const playExternalAudio = useCallback((payload: {
    videoId: string;
    title: string;
    author: string;
    coverUrl: string;
    audioUrl: string;
  }) => {
    if (!payload?.audioUrl) return;

    if (isSessionGuestRef.current) {
      toast.info("Seul l'hôte peut changer la musique de la session");
      return;
    }

    // For external items, we only play locally (no broadcast/song_id update on Supabase).
    // This matches "lecture uniquement UI" request.
    loadAndPlayExternalAudio({
      ...payload,
      autoPlay: true,
    });
  }, [loadAndPlayExternalAudio]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong, isPlaying, currentTime, duration, volume,
        queue, queueIndex, isShuffled, repeatMode, isPlayerOpen, playbackRate,
        crossfadeSeconds,
        activeSession, isSessionHost, isSessionGuest, allParticipantsReady,
        refreshSession, setActiveSession, stopAudio, refreshSongStats,
        playSong, playSongFromList, playExternalAudio,
        togglePlay, next, previous, seek, setVolume,
        toggleShuffle, cycleRepeat, openPlayer, closePlayer, setPlaybackRate,
        setCrossfadeSeconds, addToQueue, startRadio, signalVideoReady,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
