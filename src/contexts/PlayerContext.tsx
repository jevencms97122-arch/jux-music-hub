import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { songAudioUrl } from '@/lib/storage';
import { updateStreak } from '@/lib/streaks';
import { setMediaSessionMetadata, setMediaSessionHandlers, setMediaSessionPosition, clearMediaSession } from '@/lib/notifications';
import { toast } from 'sonner';
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

  playSong: (song: Song) => void;
  playSongFromList: (song: Song, list: Song[]) => void;
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
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const CROSSFADE_KEY = 'jux:crossfade';

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { authUser } = useAuth();
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<'A' | 'B'>('A');
  const crossfadingRef = useRef(false);

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
  const triggerCrossfadeRef = useRef<() => void>(() => {});
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const repeatModeRef = useRef(repeatMode);
  const isSessionGuestRef = useRef(isSessionGuest);
  useEffect(() => { crossfadeSecondsRef.current = crossfadeSeconds; }, [crossfadeSeconds]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isSessionGuestRef.current = isSessionGuest; }, [isSessionGuest]);

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

    const onTime = () => {
      const a = getActive();
      setCurrentTime(a.currentTime);
      const cf = crossfadeSecondsRef.current;
      // Pas de crossfade en mode session guest (sync gère)
      if (
        cf > 0 && !crossfadingRef.current && a.duration &&
        a.duration - a.currentTime <= cf &&
        repeatModeRef.current !== 'one' &&
        !isSessionGuestRef.current
      ) {
        triggerCrossfadeRef.current();
      }
    };
    const onDur = () => setDuration(getActive().duration || 0);
    const onEnd = () => {
      if (crossfadingRef.current) return;
      if (isSessionGuestRef.current) return; // l'host décide
      nextRef.current();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => { if (!crossfadingRef.current) setIsPlaying(false); };

    [audioARef.current, audioBRef.current].forEach((a) => {
      a.addEventListener('timeupdate', onTime);
      a.addEventListener('loadedmetadata', onDur);
      a.addEventListener('ended', onEnd);
      a.addEventListener('play', onPlay);
      a.addEventListener('pause', onPause);
    });

    return () => {
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
    [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.volume = volume; });
  }, [volume]);
  useEffect(() => {
    [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.playbackRate = playbackRate; });
  }, [playbackRate]);

  useEffect(() => { setMediaSessionMetadata(currentSong); }, [currentSong]);
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
    const v = Math.max(0, Math.min(12, s));
    setCrossfadeSecondsState(v);
    localStorage.setItem(CROSSFADE_KEY, String(v));
  }, []);

  const recordPlay = useCallback((song: Song) => {
    if (!authUser) return;
    supabase.from('listen_history').insert({ user_id: authUser.id, song_id: song.id }).then(() => {});
    supabase.from('songs').update({ play_count: (song.play_count ?? 0) + 1 }).eq('id', song.id).then(() => {});
    updateStreak(authUser.id);
  }, [authUser]);

  const stopAudio = useCallback(() => {
    [audioARef.current, audioBRef.current].forEach((a) => {
      if (!a) return;
      try { a.pause(); a.currentTime = 0; } catch {}
    });
    setIsPlaying(false);
  }, []);

  const loadAndPlay = useCallback(async (song: Song, autoPlay = true) => {
    const a = getActive();
    if (!a) return;
    a.src = songAudioUrl(song);
    a.playbackRate = playbackRate;
    a.volume = volume;
    if (!autoPlay) { a.load(); return; }
    try {
      await a.play();
      recordPlay(song);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, [playbackRate, volume, recordPlay]);

  const triggerCrossfade = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = isShuffled ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode !== 'all') return;
    }
    const realNextIdx = nextIdx >= queue.length ? 0 : nextIdx;
    const nextSong = queue[realNextIdx];
    if (!nextSong) return;

    crossfadingRef.current = true;
    const fromAudio = getActive();
    const toAudio = getInactive();
    toAudio.src = songAudioUrl(nextSong);
    toAudio.playbackRate = playbackRate;
    toAudio.volume = 0;
    toAudio.play().catch(console.error);

    const dur = crossfadeSeconds * 1000;
    const steps = 30;
    const stepTime = dur / steps;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      const ratio = i / steps;
      fromAudio.volume = Math.max(0, volume * (1 - ratio));
      toAudio.volume = Math.min(volume, volume * ratio);
      if (i >= steps) {
        clearInterval(interval);
        fromAudio.pause();
        fromAudio.currentTime = 0;
        fromAudio.volume = volume;
        activeRef.current = activeRef.current === 'A' ? 'B' : 'A';
        setCurrentSong(nextSong);
        setQueueIndex(realNextIdx);
        setPlayedSongIds((p) => new Set([...p, nextSong.id]));
        recordPlay(nextSong);
        crossfadingRef.current = false;
      }
    }, stepTime);
  }, [queue, queueIndex, repeatMode, isShuffled, crossfadeSeconds, playbackRate, volume, recordPlay]);

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
    if (a.paused) a.play().catch(console.error);
    else a.pause();
    // Host : broadcast play/pause
    const s = sessionRef.current;
    if (s && authUser && s.host_id === authUser.id) {
      supabase.from('listen_sessions').update({
        is_playing: a.paused ? false : true,
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

  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { triggerCrossfadeRef.current = triggerCrossfade; }, [triggerCrossfade]);

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
      a.play().catch(console.error);
    } else {
      a.pause();
    }
  }, [isSessionGuest, activeSession?.is_playing, activeSession?.current_time_seconds, activeSession]);

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
      // Sync is_playing si écart
      if (sessionRef.current.is_playing !== !a.paused) {
        updates.is_playing = !a.paused;
      }
      supabase.from('listen_sessions').update(updates).eq('id', sessionRef.current.id).then(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [isSessionHost, activeSession?.id, activeSession]);

  // HOST : quand tout le monde est prêt et qu'on a une song mais is_playing=false → lancer
  useEffect(() => {
    if (!isSessionHost || !activeSession?.song_id) return;
    if (activeSession.is_playing) return;
    if (!allParticipantsReady) return;
    const a = getActive();
    if (a && a.paused) {
      a.play().then(() => {
        supabase.from('listen_sessions').update({
          is_playing: true,
          current_time_seconds: a.currentTime,
        }).eq('id', activeSession.id).then(() => {});
      }).catch(console.error);
    }
  }, [isSessionHost, allParticipantsReady, activeSession]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong, isPlaying, currentTime, duration, volume,
        queue, queueIndex, isShuffled, repeatMode, isPlayerOpen, playbackRate,
        crossfadeSeconds,
        activeSession, isSessionHost, isSessionGuest, allParticipantsReady,
        refreshSession, setActiveSession, stopAudio,
        playSong, playSongFromList, togglePlay, next, previous, seek, setVolume,
        toggleShuffle, cycleRepeat, openPlayer, closePlayer, setPlaybackRate,
        setCrossfadeSeconds, addToQueue, startRadio,
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
