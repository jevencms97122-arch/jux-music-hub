import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { pb, getPbUrl } from '@/lib/pocketbase';
import { songAudioUrl, songCoverUrl } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { extractDominantHsl, applyAccentHsl } from '@/lib/dominantColor';
import { updateStreak } from '@/lib/streaks';
import { setMediaSessionMetadata, setMediaSessionHandlers, setMediaSessionPosition, setMediaSessionPlaybackState, clearMediaSession } from '@/lib/notifications';
import { sendNowPlayingToNative, clearNowPlayingOnNative, onNativeCommand, resolveCoverUrl } from '@/lib/androidMediaBridge';
import type { NativeCommandEvent } from '@/lib/androidMediaBridge';
import { toast } from 'sonner';
import { updatePresence, clearPresence } from '@/lib/userPresence';
import type { Song } from '@/types/music';
import { getPlayableAudioUrl, ensureCachedForPlayback, initOfflineManager } from '@/lib/offlineManager';

export type TransitionMode = 'linear' | 'hardCut' | 'exponential' | 'logarithmic' | 'sine' | 'sCurve' | 'elastic' | 'cubicEaseInOut' | 'quartEaseInOut' | 'tempoShift';

export type ConnectionStatus = 'stable' | 'slow' | 'unstable';

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
  transitionMode: TransitionMode;
  activeSession: ListenSessionRow | null;
  isSessionHost: boolean;
  isSessionGuest: boolean;
  allParticipantsReady: boolean;
  connectionStatus: ConnectionStatus;
  refreshSession: () => Promise<void>;
  setActiveSession: (s: ListenSessionRow | null) => void;
  stopAudio: () => void;
  refreshSongStats: (songId: string) => Promise<void>;
  playSong: (song: Song) => void;
  playSongFromList: (song: Song, list: Song[]) => void;
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
  setTransitionMode: (mode: TransitionMode) => void;
  addToQueue: (song: Song) => void;
  startRadio: (seed: Song) => Promise<void>;
  signalVideoReady: () => void;
  getAnalyserNode: () => AnalyserNode | null;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const CROSSFADE_KEY = 'jux:crossfade';
const TRANSITION_MODE_KEY = 'jux:transitionMode';

export const TRANSITION_MODES: { value: TransitionMode; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear', description: 'Transition linéaire classique' },
  { value: 'hardCut', label: 'Hard Cut', description: 'Passage instantané (pas de fade)' },
  { value: 'exponential', label: 'Exponentiel', description: 'Rapide au début, lent à la fin' },
  { value: 'logarithmic', label: 'Logarithmique', description: 'Lent au début, rapide à la fin' },
  { value: 'sine', label: 'Sine Wave', description: 'Courbe sinusoïdale très lisse' },
  { value: 'sCurve', label: 'S-Curve', description: 'Courbe S prononcée' },
  { value: 'elastic', label: 'Elastic', description: 'Effet élastique avancé' },
  { value: 'cubicEaseInOut', label: 'Cubic Ease', description: 'Lisse cubique très fluide' },
  { value: 'quartEaseInOut', label: 'Quart Ease', description: 'Lisse quartique très progressive' },
  { value: 'tempoShift', label: 'Tempo Shift', description: 'Ralentit puis accélère le tempo' },
];

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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<'A' | 'B'>('A');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const crossfadingRef = useRef(false);
  const crossfadeIntervalRef = useRef<number | null>(null);
  const userRef = useRef(authUser);
  const currentSongRef = useRef<Song | null>(null);

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
  const [transitionMode, setTransitionModeState] = useState<TransitionMode>(() => {
    const mode = localStorage.getItem(TRANSITION_MODE_KEY) as TransitionMode | null;
    return (mode && TRANSITION_MODES.some(m => m.value === mode)) ? mode : 'linear';
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('stable');

  const videoReadyRef = useRef(false);
  const signalVideoReady = useCallback(() => { videoReadyRef.current = true; }, []);

  // Session
  const [activeSession, setActiveSessionState] = useState<ListenSessionRow | null>(null);
  const sessionRef = useRef<ListenSessionRow | null>(null);
  useEffect(() => { sessionRef.current = activeSession; }, [activeSession]);
  const isSessionHost = !!(activeSession && authUser && activeSession.host_id === authUser.id);
  const isSessionGuest = !!(activeSession && authUser && activeSession.host_id !== authUser.id);
  const allParticipantsReady = !!activeSession && activeSession.participants.every((p) => activeSession.ready_participants?.includes(p));
  const setActiveSession = useCallback((s: ListenSessionRow | null) => setActiveSessionState(s), []);

  const getActive = () => (activeRef.current === 'A' ? audioARef.current! : audioBRef.current!);
  const getInactive = () => (activeRef.current === 'A' ? audioBRef.current! : audioARef.current!);

  const calculateFadePosition = useCallback((p: number, mode: TransitionMode): number => {
    if (mode === 'hardCut') return p >= 1 ? 1 : 0;
    if (mode === 'linear') return p;
    if (mode === 'exponential') return p * p * p * p;
    if (mode === 'logarithmic') return 1 - Math.pow(1 - p, 4);
    if (mode === 'sine') return Math.pow(Math.sin(p * Math.PI / 2), 2.5);
    if (mode === 'sCurve') return p < 0.5 ? 2 * Math.pow(p, 3) : 1 - 2 * Math.pow(1 - p, 3);
    if (mode === 'elastic') { if (p === 0) return 0; if (p === 1) return 1; const c5 = (2 * Math.PI) / 3.5; return Math.pow(2, -12 * p) * Math.sin((p - 0.1) * c5) + 1; }
    if (mode === 'cubicEaseInOut') { const base = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; if (p > 0.7) { const overshoot = Math.sin((p - 0.7) * Math.PI / 0.6) * 0.08; return Math.min(base + overshoot, 1); } return base; }
    if (mode === 'quartEaseInOut') { const base = p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2; if (p > 0.65) { const overshoot = Math.sin((p - 0.65) * Math.PI / 0.7) * 0.12; return Math.min(base + overshoot, 1); } return base; }
    return p;
  }, []);

  const nextRef = useRef<() => void>(() => {});
  const previousRef = useRef<() => void>(() => {});
  const togglePlayRef = useRef<() => void>(() => {});
  const seekRef = useRef<(t: number) => void>(() => {});
  const stopAudioRef = useRef<() => void>(() => {});
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const transitionModeRef = useRef(transitionMode);
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
  useEffect(() => { transitionModeRef.current = transitionMode; }, [transitionMode]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isSessionGuestRef.current = isSessionGuest; }, [isSessionGuest]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { isShuffledRef.current = isShuffled; }, [isShuffled]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { userRef.current = authUser; }, [authUser]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

  const recordPlayRef = useRef<(s: Song) => void>(() => {});
  const broadcastSongRef = useRef<(s: Song) => void>(() => {});

  const triggerCrossfadeRef = useRef<() => void>(() => {
    if (crossfadingRef.current) return;
    const fadeSec = crossfadeSecondsRef.current;
    if (fadeSec <= 0) return;
    if (isSessionGuestRef.current) return;
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;
    let nextIdx: number;
    if (repeatModeRef.current === 'one') return;
    else if (isShuffledRef.current) nextIdx = Math.floor(Math.random() * q.length);
    else nextIdx = idx + 1;
    if (nextIdx >= q.length) { if (repeatModeRef.current === 'all') nextIdx = 0; else return; }
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
      const mode = transitionModeRef.current;
      if (crossfadeIntervalRef.current) clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - startTs) / fadeMs);
        const fadeCurve = calculateFadePosition(p, mode);
        if (mode === 'tempoShift') {
          if (p < 0.5) {
            const slowdownCurve = p * 2;
            active.playbackRate = playbackRateRef.current * (1 - slowdownCurve * 0.7);
            active.volume = Math.max(0, startVol * (1 - slowdownCurve));
            inactive.volume = 0;
          } else {
            const speedupCurve = (p - 0.5) * 2;
            inactive.playbackRate = playbackRateRef.current * (0.3 + speedupCurve * 0.7);
            inactive.volume = Math.min(1, targetVol * speedupCurve * 2);
            active.volume = 0;
          }
        } else {
          active.volume = Math.max(0, startVol * (1 - fadeCurve));
          inactive.volume = Math.min(1, targetVol * fadeCurve);
        }
        if (p >= 1) {
          if (crossfadeIntervalRef.current) { clearInterval(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
          try { active.pause(); active.currentTime = 0; active.removeAttribute('src'); active.load(); } catch {}
          activeRef.current = activeRef.current === 'A' ? 'B' : 'A';
          inactive.volume = targetVol;
          inactive.playbackRate = playbackRateRef.current;
          setDuration(inactive.duration || 0);
          setCurrentTime(inactive.currentTime || 0);
          setQueueIndex(nextIdx);
          setCurrentSong(nextSong);
          setPlayedSongIds(prev => new Set([...prev, nextSong.id]));
          setIsPlaying(true);
          recordPlayRef.current(nextSong);
          if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSongRef.current(nextSong);
          crossfadingRef.current = false;
        }
      }, 50) as unknown as number;
    };
    const onReady = () => { inactive.removeEventListener('canplay', onReady); inactive.play().then(startFade).catch((e) => { console.error('Crossfade play failed', e); crossfadingRef.current = false; }); };
    inactive.addEventListener('canplay', onReady);
    inactive.load();
  });

  // Init audio
  useEffect(() => {
    initOfflineManager().catch(() => {});
    const create = () => { const a = new Audio(); a.preload = 'auto'; (a as any).preservesPitch = false; (a as any).mozPreservesPitch = false; (a as any).webkitPreservesPitch = false; a.crossOrigin = 'anonymous'; return a; };
    audioARef.current = create();
    audioBRef.current = create();

    // Web Audio API — analyser for reactive visualisations
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      analyser.connect(ctx.destination);
      ctx.createMediaElementSource(audioARef.current).connect(analyser);
      ctx.createMediaElementSource(audioBRef.current).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {}

    const onTime = (e: Event) => {
      const a = getActive();
      if (e.target !== a) return;
      setCurrentTime(a.currentTime);
      const dur = a.duration;
      if (!isFinite(dur) || dur <= 0) return;
      const fadeDuration = crossfadeSecondsRef.current;
      const remaining = dur - a.currentTime;
      if (fadeDuration > 0 && remaining <= fadeDuration && remaining > 0.1 && !crossfadingRef.current && !isSessionGuestRef.current && repeatModeRef.current !== 'one') triggerCrossfadeRef.current();
    };
    const onDur = (e: Event) => { if (e.target === getActive()) setDuration(getActive().duration || 0); };
    const onEnd = (e: Event) => { if (e.target !== getActive()) return; if (crossfadingRef.current) return; if (isSessionGuestRef.current) return; nextRef.current(); };
    const onPlay = (e: Event) => {
      if (e.target !== getActive()) return;
      setIsPlaying(true);
      const au = userRef.current;
      const cs = currentSongRef.current;
      if (au && cs) updatePresence({ userId: au.id, isListening: true, songId: cs.id, songTitle: cs.title, songAuthor: cs.author, songCoverUrl: songCoverUrl(cs) });
    };
    const onPause = (e: Event) => { if (e.target !== getActive()) return; if (!crossfadingRef.current) setIsPlaying(false); };
    [audioARef.current, audioBRef.current].forEach((a) => { a.addEventListener('timeupdate', onTime); a.addEventListener('loadedmetadata', onDur); a.addEventListener('ended', onEnd); a.addEventListener('play', onPlay); a.addEventListener('pause', onPause); });
    return () => {
      if (crossfadeIntervalRef.current) { clearInterval(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
      crossfadingRef.current = false;
      [audioARef.current, audioBRef.current].forEach((a) => { if (!a) return; a.pause(); a.removeEventListener('timeupdate', onTime); a.removeEventListener('loadedmetadata', onDur); a.removeEventListener('ended', onEnd); a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); });
      clearMediaSession();
    };
  }, []);

  useEffect(() => { const a = getActive(); if (a) a.volume = volume; }, [volume]);
  useEffect(() => { [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.playbackRate = playbackRate; }); }, [playbackRate]);

  // Android bridge
  useEffect(() => {
    if (!currentSong) { clearNowPlayingOnNative(); return; }
    const coverUrl = resolveCoverUrl(songCoverUrl(currentSong));
    sendNowPlayingToNative({ songId: currentSong.id, title: currentSong.title || 'Sans titre', author: currentSong.author || 'Inconnu', coverUrl, duration, currentTime, isPlaying, playbackRate, volume, repeatMode, isShuffled });
  }, [currentSong, isPlaying, currentTime, duration, playbackRate, volume, repeatMode, isShuffled]);

  useEffect(() => {
    const unsubscribe = onNativeCommand((event: NativeCommandEvent) => {
      switch (event.command) {
        case 'play': getActive()?.play().catch(console.error); break;
        case 'pause': getActive()?.pause(); break;
        case 'togglePlay': case 'play_pause': togglePlayRef.current(); break;
        case 'next': nextRef.current(); break;
        case 'previous': case 'prev': previousRef.current(); break;
        case 'seek': if (event.seekTime != null) seekRef.current(event.seekTime); break;
        case 'stop': stopAudioRef.current(); break;
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { setMediaSessionMetadata(currentSong); }, [currentSong]);
  useEffect(() => { setMediaSessionPlaybackState(currentSong ? (isPlaying ? 'playing' : 'paused') : 'none'); }, [isPlaying, currentSong]);

  useEffect(() => {
    if (!currentSong) { applyAccentHsl(null); return; }
    let cancelled = false;
    extractDominantHsl(songCoverUrl(currentSong)).then((hsl) => { if (!cancelled) applyAccentHsl(hsl); });
    return () => { cancelled = true; };
  }, [currentSong]);

  useEffect(() => { setMediaSessionHandlers({ play: () => getActive()?.play(), pause: () => getActive()?.pause(), next: () => next(), previous: () => previous(), seek: (t) => seek(t) }); }, [queue, queueIndex, repeatMode, isShuffled]);
  useEffect(() => { setMediaSessionPosition(duration, currentTime, playbackRate); }, [duration, currentTime, playbackRate]);

  const setCrossfadeSeconds = useCallback((s: number) => {
    const v = s <= 0 ? 0 : Math.max(1, Math.min(12, s));
    setCrossfadeSecondsState(v);
    localStorage.setItem(CROSSFADE_KEY, String(v));
    crossfadeSecondsRef.current = v;
  }, []);

  const setTransitionMode = useCallback((mode: TransitionMode) => {
    setTransitionModeState(mode);
    localStorage.setItem(TRANSITION_MODE_KEY, mode);
    transitionModeRef.current = mode;
  }, []);

  // PocketBase helpers
  const pbGetFirst = async (collection: string, filter: string) => {
    try {
      const result = await pb.collection(collection).getList(1, 1, { filter, requestKey: null });
      return result.items[0] || null;
    } catch { return null; }
  };

  const refreshSongStats = useCallback(async (songId: string) => {
    try {
      const record = await pbGetFirst('songs', `id = "${songId}"`);
      if (record) {
        const data = { play_count: record.play_count ?? 0, likes_count: record.likes_count ?? 0 };
        setCurrentSong((cur) => cur?.id === songId ? { ...cur, ...data } : cur);
        setQueue((q) => q.map((s) => s.id === songId ? { ...s, ...data } : s));
      }
    } catch {}
  }, []);

  // Increment play counts via PocketBase
  const incrementPlayCount = useCallback(async (songId: string) => {
    try {
      const record = await pbGetFirst('songs', `id = "${songId}"`);
      if (record) {
        const current = record.play_count ?? 0;
        await pb.collection('songs').update(record.id, { play_count: current + 1 });
        setCurrentSong((cur) => cur?.id === songId ? { ...cur, play_count: current + 1 } : cur);
        setQueue((q) => q.map((s) => s.id === songId ? { ...s, play_count: current + 1 } : s));
      }
    } catch (e) { console.error('incrementPlayCount', e); }
  }, []);

  const incrementWeeklyPlayCount = useCallback(async (songId: string) => {
    try {
      const record = await pbGetFirst('songs', `id = "${songId}"`);
      if (record) {
        const current = record.weekly_play_count ?? 0;
        await pb.collection('songs').update(record.id, { weekly_play_count: current + 1 });
        setCurrentSong((cur) => cur?.id === songId ? { ...cur, weekly_play_count: current + 1 } : cur);
        setQueue((q) => q.map((s) => s.id === songId ? { ...s, weekly_play_count: current + 1 } : s));
      }
    } catch (e) { console.error('incrementWeeklyPlayCount', e); }
  }, []);

  const countedWeeklyRef = useRef<Set<string>>(new Set());
  const weeklyListenStartRef = useRef<Map<string, number>>(new Map());
  const pauseTimeoutRef = useRef<number | null>(null);

  const recordPlay = useCallback((song: Song) => {
    if (!authUser) return;
    if (pauseTimeoutRef.current) { clearTimeout(pauseTimeoutRef.current); pauseTimeoutRef.current = null; }
    
    // Record listen history
    pb.collection('listen_history').create({ user_id: authUser.id, song_id: song.id, listened_at: new Date().toISOString() }).catch(() => {});
    
    updateStreak(authUser.id);
    updatePresence({ userId: authUser.id, isListening: true, songId: song.id, songTitle: song.title, songAuthor: song.author, songCoverUrl: songCoverUrl(song) });
    
    incrementPlayCount(song.id);
    weeklyListenStartRef.current.set(song.id, 0);
    countedWeeklyRef.current.delete(song.id);
  }, [authUser, incrementPlayCount]);

  useEffect(() => { recordPlayRef.current = recordPlay; }, [recordPlay]);

  // Weekly play count after 30s
  useEffect(() => {
    if (!currentSong || !authUser) return;
    const songId = currentSong.id;
    if (countedWeeklyRef.current.has(songId)) return;
    const prev = weeklyListenStartRef.current.get(songId) ?? 0;
    const reached = Math.max(prev, currentTime);
    weeklyListenStartRef.current.set(songId, reached);
    if (reached >= 30) {
      countedWeeklyRef.current.add(songId);
      incrementWeeklyPlayCount(songId);
    }
  }, [currentTime, currentSong, authUser, incrementWeeklyPlayCount]);

  const stopAudio = useCallback(() => {
    [audioARef.current, audioBRef.current].forEach((a) => { if (!a) return; try { a.pause(); a.currentTime = 0; } catch {} });
    setIsPlaying(false);
    if (authUser) clearPresence(authUser.id);
  }, [authUser]);

  const loadAndPlay = useCallback(async (song: Song, autoPlay = true) => {
    if (crossfadeIntervalRef.current) { clearInterval(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
    crossfadingRef.current = false;
    const inactive = getInactive();
    if (inactive) { try { inactive.pause(); inactive.volume = 0; inactive.removeAttribute('src'); inactive.load(); } catch {} }
    const a = getActive();
    if (!a) return;
    a.src = await getPlayableAudioUrl(song);
    a.volume = volume;
    const applyRate = () => { a.playbackRate = playbackRate; };
    applyRate();
    a.addEventListener('loadedmetadata', applyRate, { once: true });
    a.addEventListener('playing', applyRate, { once: true });
    const inSessionAsHost = !!(sessionRef.current && authUser && sessionRef.current.host_id === authUser.id);
    if (!autoPlay || inSessionAsHost) { pendingSessionAutoplayRef.current = !!inSessionAsHost; a.load(); return; }
    try { if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume().catch(() => {}); await a.play(); a.playbackRate = playbackRate; recordPlay(song); ensureCachedForPlayback(song).catch(() => {}); } catch (e) { console.error('Audio play failed', e); }
  }, [playbackRate, volume, recordPlay, authUser]);

  const loadAndPlayExternalAudio = useCallback(async (payload: { videoId: string; title: string; author: string; coverUrl: string; audioUrl: string; autoPlay?: boolean }) => {
    if (crossfadeIntervalRef.current) { clearInterval(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
    crossfadingRef.current = false;
    const inactive = getInactive();
    if (inactive) { try { inactive.pause(); inactive.volume = 0; inactive.removeAttribute('src'); inactive.load(); } catch {} }
    const a = getActive();
    if (!a) return;
    const externalSong: Song = { id: `external:${payload.videoId}`, title: payload.title, author: payload.author, audio_url: '', cover_url: payload.coverUrl ?? null, video_url: payload.videoId ? `external-video:${payload.videoId}` : null, genre: null, uploaded_by: authUser?.id ?? 'external', play_count: 0, weekly_play_count: 0, likes_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setCurrentSong(externalSong); setQueue([externalSong]); setQueueIndex(0);
    a.src = payload.audioUrl; a.volume = volume;
    const applyRate = () => { a.playbackRate = playbackRate; }; applyRate();
    a.addEventListener('loadedmetadata', applyRate, { once: true });
    a.addEventListener('playing', applyRate, { once: true });
    const inSessionAsHost = !!(sessionRef.current && authUser && sessionRef.current.host_id === authUser.id);
    const shouldAutoPlay = payload.autoPlay ?? true;
    if (!shouldAutoPlay || inSessionAsHost) { pendingSessionAutoplayRef.current = !!inSessionAsHost; a.load(); return; }
    try { await a.play(); a.playbackRate = playbackRate; } catch (e) { console.error('External audio play failed', e); }
  }, [playbackRate, volume, authUser]);

  const broadcastSong = useCallback(async (song: Song) => {
    const s = sessionRef.current;
    if (!s || !authUser || s.host_id !== authUser.id) return;
    try {
      await pb.collection('listen_sessions').update(s.id, { song_id: song.id, current_time_seconds: 0, is_playing: false, ready_participants: [authUser.id] });
    } catch {}
  }, [authUser]);
  useEffect(() => { broadcastSongRef.current = broadcastSong; }, [broadcastSong]);

  // Ping PocketBase toutes les 3 secondes pour vérifier la qualité de la connexion
  const checkConnectionStatus = useCallback(async () => {
    const url = getPbUrl();
    const start = performance.now();
    try {
      const resp = await fetch(`${url}/api/health`, { method: 'HEAD', cache: 'no-store' });
      const elapsed = performance.now() - start;
      if (resp.ok && elapsed < 300) {
        setConnectionStatus('stable');
      } else if (resp.ok) {
        setConnectionStatus('slow');
      } else {
        setConnectionStatus('unstable');
      }
    } catch (e: any) {
      // En cas d'erreur on définit comme instable
      setConnectionStatus('unstable');
    }
  }, []);

  // Intervalle toutes les 3 secondes pour mettre à jour le statut de connexion
  useEffect(() => {
    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [checkConnectionStatus]);

  const playSong = useCallback((song: Song) => {
    if (isSessionGuestRef.current) { toast.info("Seul l'hôte peut changer la musique de la session"); return; }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    setCurrentSong(song); setQueue([song]); setQueueIndex(0); setPlayedSongIds(new Set([song.id])); setIsPlayerOpen(true);
    checkConnectionStatus();
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
    // Auto-queue likes
    if (authUser) {
      (async () => {
        try {
          const likeRecords = await pb.collection('song_likes').getList(1, 1, { filter: `user_id = "${authUser.id}" && song_id = "${song.id}"`, requestKey: null });
          if (likeRecords.items.length === 0) return;
          const allLikes = await pb.collection('song_likes').getList(1, 200, { filter: `user_id = "${authUser.id}"`, requestKey: null });
          const otherIds = allLikes.items.map((l: any) => l.song_id).filter((id: string) => id !== song.id);
          if (otherIds.length === 0) return;
          // Fetch songs by batches
          const songs: Song[] = [];
          for (let i = 0; i < otherIds.length; i += 50) {
            const batch = otherIds.slice(i, i + 50);
            const filters = batch.map((id: string) => `id = "${id}"`).join(' || ');
            const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
            songs.push(...res.items.map(recordToSong));
          }
          for (let i = songs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [songs[i], songs[j]] = [songs[j], songs[i]]; }
          setQueue((q) => (q.length === 1 && q[0].id === song.id ? [song, ...songs] : q));
        } catch {}
      })();
    }
  }, [loadAndPlay, authUser, broadcastSong]);

  const playSongFromList = useCallback((song: Song, list: Song[]) => {
    if (isSessionGuestRef.current) { toast.info("Seul l'hôte peut changer la musique de la session"); return; }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    const idx = Math.max(0, list.findIndex((s) => s.id === song.id));
    setQueue(list); setQueueIndex(idx); setCurrentSong(song); setPlayedSongIds(new Set([song.id])); setIsPlayerOpen(true);
    checkConnectionStatus();
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
  }, [loadAndPlay, authUser, broadcastSong, checkConnectionStatus]);

  const togglePlay = useCallback(() => {
    const a = getActive();
    if (!a || !currentSong) return;
    if (isSessionGuestRef.current) { toast.info("Seul l'hôte peut contrôler la lecture"); return; }
    // Resume AudioContext on user gesture (browser autoplay policy)
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
    const shouldPlay = a.paused;
    pendingSessionAutoplayRef.current = false;
    if (shouldPlay) {
      a.play().catch(console.error);
      if (authUser) updatePresence({ userId: authUser.id, isListening: true, songId: currentSong.id, songTitle: currentSong.title, songAuthor: currentSong.author, songCoverUrl: songCoverUrl(currentSong) });
    } else { a.pause(); if (authUser) clearPresence(authUser.id); }
    const s = sessionRef.current;
    if (s && authUser && s.host_id === authUser.id) {
      pb.collection('listen_sessions').update(s.id, { is_playing: shouldPlay, current_time_seconds: a.currentTime }).catch(() => {});
    }
  }, [currentSong, authUser]);

  const findRecommendedSongs = useCallback(async (baseSong: Song): Promise<Song[]> => {
    try {
      const result = await pb.collection('songs').getList(1, 500, { sort: '-play_count', requestKey: null });
      const all = result.items.map(recordToSong);
      const queueIds = new Set(queue.map((s) => s.id));
      const filtered = all.filter((s) => !playedSongIds.has(s.id) && !queueIds.has(s.id) && s.id !== baseSong.id);
      const sameGenre = filtered.filter((s) => s.genre && s.genre === baseSong.genre).sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));
      if (sameGenre.length > 0) return sameGenre.slice(0, 20);
      return filtered.sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0)).slice(0, 20);
    } catch { return []; }
  }, [playedSongIds, queue]);

  const playAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= queue.length) return;
    const song = queue[idx];
    setQueueIndex(idx); setCurrentSong(song); setPlayedSongIds((prev) => new Set([...prev, song.id]));
    loadAndPlay(song);
    if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
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
            const song = rec[0]; const len = queue.length;
            setCurrentSong(song); setQueue((q) => [...q, ...rec]); setQueueIndex(len);
            setPlayedSongIds((p) => new Set([...p, song.id])); loadAndPlay(song);
            if (sessionRef.current && authUser && sessionRef.current.host_id === authUser.id) broadcastSong(song);
          } else getActive()?.pause();
        });
      } else getActive()?.pause();
    } else playAtIndex(nextIdx);
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
    if (s && authUser && s.host_id === authUser.id) pb.collection('listen_sessions').update(s.id, { current_time_seconds: t }).catch(() => {});
  }, [authUser]);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleShuffle = useCallback(() => setIsShuffled((s) => !s), []);
  const cycleRepeat = useCallback(() => setRepeatMode((m) => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'), []);
  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
  const setPlaybackRate = useCallback((r: number) => setPlaybackRateState(Math.max(0.5, Math.min(2, r))), []);
  const addToQueue = useCallback((song: Song) => setQueue((q) => [...q, song]), []);

  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { previousRef.current = previous; }, [previous]);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { seekRef.current = seek; }, [seek]);
  useEffect(() => { stopAudioRef.current = stopAudio; }, [stopAudio]);

  const startRadio = useCallback(async (seed: Song) => {
    const rec = await findRecommendedSongs(seed);
    const list = [seed, ...rec];
    setQueue(list); setQueueIndex(0); setCurrentSong(seed); setPlayedSongIds(new Set([seed.id])); loadAndPlay(seed);
  }, [findRecommendedSongs, loadAndPlay]);

  // Session management with PocketBase
  const refreshSession = useCallback(async () => {
    if (!authUser) { setActiveSessionState(null); return; }
    try {
      const hosted = await pbGetFirst('listen_sessions', `host_id = "${authUser.id}" && is_active = true`);
      if (hosted) { setActiveSessionState(hosted as unknown as ListenSessionRow); return; }
      // For joined sessions, we fetch with participant filter
      const joinedRes = await pb.collection('listen_sessions').getList(1, 1, { filter: `is_active = true`, requestKey: null });
      const joined = joinedRes.items.find((r: any) => {
        const participants = r.participants as string[] || [];
        return participants.includes(authUser.id);
      });
      setActiveSessionState((joined as unknown as ListenSessionRow) ?? null);
    } catch {}
  }, [authUser]);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  // Polling for session changes (PocketBase doesn't have realtime built-in like Supabase)
  useEffect(() => {
    if (!authUser) return;
    const interval = setInterval(() => { refreshSession(); }, 3000);
    return () => clearInterval(interval);
  }, [authUser, refreshSession]);

  // Guest: load session song
  const lastLoadedSessionSongRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSessionGuest || !activeSession || !authUser) return;
    if (!activeSession.song_id) return;
    if (lastLoadedSessionSongRef.current === activeSession.song_id) return;
    lastLoadedSessionSongRef.current = activeSession.song_id;
    (async () => {
      try {
        const record = await pbGetFirst('songs', `id = "${activeSession.song_id}"`);
        if (!record) return;
        const song = recordToSong(record);
        sessionGuestRecordedRef.current = null; setCurrentSong(song); setQueue([song]); setQueueIndex(0);
        const a = getActive(); a.src = songAudioUrl(song); a.playbackRate = playbackRate; a.volume = volume; a.load();
        const onCanPlay = async () => {
          a.removeEventListener('canplaythrough', onCanPlay);
          const cur = sessionRef.current;
          if (!cur || !authUser) return;
          const ready = cur.ready_participants ?? [];
          if (!ready.includes(authUser.id)) pb.collection('listen_sessions').update(cur.id, { ready_participants: [...ready, authUser.id] }).catch(() => {});
        };
        a.addEventListener('canplaythrough', onCanPlay);
      } catch {}
    })();
  }, [isSessionGuest, activeSession?.song_id, authUser, playbackRate, volume, activeSession]);

  // Guest sync play/pause
  useEffect(() => {
    if (!isSessionGuest || !activeSession) return;
    const a = getActive();
    if (!a || !a.src) return;
    if (Math.abs(a.currentTime - activeSession.current_time_seconds) > 1.5) a.currentTime = activeSession.current_time_seconds;
    if (activeSession.is_playing) { a.play().then(() => { if (currentSong && sessionGuestRecordedRef.current !== currentSong.id) { sessionGuestRecordedRef.current = currentSong.id; recordPlay(currentSong); } }).catch(console.error); }
    else a.pause();
  }, [isSessionGuest, activeSession?.is_playing, activeSession?.current_time_seconds, activeSession, currentSong, recordPlay]);

  // Host sync time
  useEffect(() => {
    if (!isSessionHost || !activeSession) return;
    const interval = setInterval(() => {
      const a = getActive();
      if (!a || !sessionRef.current) return;
      const updates: any = { current_time_seconds: a.currentTime };
      if (a.paused && sessionRef.current.is_playing) updates.is_playing = false;
      pb.collection('listen_sessions').update(sessionRef.current.id, updates).catch(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [isSessionHost, activeSession?.id, activeSession]);

  // Host: autoplay when all ready
  useEffect(() => {
    if (!isSessionHost || !activeSession?.song_id) return;
    if (activeSession.is_playing || !pendingSessionAutoplayRef.current) return;
    if (!allParticipantsReady) return;
    const a = getActive();
    if (a && a.paused) {
      a.play().then(() => { pendingSessionAutoplayRef.current = false; if (currentSong) recordPlay(currentSong); pb.collection('listen_sessions').update(activeSession.id, { is_playing: true, current_time_seconds: a.currentTime }).catch(() => {}); }).catch(console.error);
    }
  }, [isSessionHost, allParticipantsReady, activeSession, currentSong, recordPlay]);

  const playExternalAudio = useCallback((payload: { videoId: string; title: string; author: string; coverUrl: string; audioUrl: string }) => {
    if (!payload?.audioUrl) return;
    if (isSessionGuestRef.current) { toast.info("Seul l'hôte peut changer la musique de la session"); return; }
    loadAndPlayExternalAudio({ ...payload, autoPlay: true });
  }, [loadAndPlayExternalAudio]);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, currentTime, duration, volume, queue, queueIndex, isShuffled, repeatMode, isPlayerOpen, playbackRate, crossfadeSeconds, transitionMode,
      activeSession, isSessionHost, isSessionGuest, allParticipantsReady, connectionStatus, refreshSession, setActiveSession, stopAudio, refreshSongStats,
      playSong, playSongFromList, playExternalAudio, togglePlay, next, previous, seek, setVolume, toggleShuffle, cycleRepeat,
      openPlayer, closePlayer, setPlaybackRate, setCrossfadeSeconds, setTransitionMode, addToQueue, startRadio, signalVideoReady,
      getAnalyserNode: () => analyserRef.current,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}