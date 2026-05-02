import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { songAudioUrl } from '@/lib/storage';
import { updateStreak } from '@/lib/streaks';
import { setMediaSessionMetadata, setMediaSessionHandlers, setMediaSessionPosition, clearMediaSession } from '@/lib/notifications';
import type { Song } from '@/types/music';

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
  // Deux éléments audio pour permettre le crossfade
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

  const getActive = () => (activeRef.current === 'A' ? audioARef.current! : audioBRef.current!);
  const getInactive = () => (activeRef.current === 'A' ? audioBRef.current! : audioARef.current!);

  // Refs vers les dernières fonctions pour éviter les closures stales dans les listeners
  const nextRef = useRef<() => void>(() => {});
  const triggerCrossfadeRef = useRef<() => void>(() => {});
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => { crossfadeSecondsRef.current = crossfadeSeconds; }, [crossfadeSeconds]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

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
      if (
        cf > 0 &&
        !crossfadingRef.current &&
        a.duration &&
        a.duration - a.currentTime <= cf &&
        repeatModeRef.current !== 'one'
      ) {
        triggerCrossfadeRef.current();
      }
    };
    const onDur = () => setDuration(getActive().duration || 0);
    const onEnd = () => { if (!crossfadingRef.current) nextRef.current(); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      // Ne pas marquer pause pendant le crossfade
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

  // Sync volume + rate sur les deux
  useEffect(() => {
    [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.volume = volume; });
  }, [volume]);
  useEffect(() => {
    [audioARef.current, audioBRef.current].forEach((a) => { if (a) a.playbackRate = playbackRate; });
  }, [playbackRate]);

  // MediaSession
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
    supabase.from('songs')
      .update({ play_count: (song.play_count ?? 0) + 1 })
      .eq('id', song.id).then(() => {});
    updateStreak(authUser.id);
  }, [authUser]);

  const loadAndPlay = useCallback(async (song: Song) => {
    const a = getActive();
    if (!a) return;
    a.src = songAudioUrl(song);
    a.playbackRate = playbackRate;
    a.volume = volume;
    try {
      await a.play();
      recordPlay(song);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, [playbackRate, volume, recordPlay]);

  // Crossfade vers le prochain morceau
  const triggerCrossfade = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = isShuffled ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode !== 'all') return; // pas de prochain → laisser onEnded gérer
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

    const duration = crossfadeSeconds * 1000;
    const steps = 30;
    const stepTime = duration / steps;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, queueIndex, repeatMode, isShuffled, crossfadeSeconds, playbackRate, volume, recordPlay]);

  const playSong = useCallback((song: Song) => {
    setCurrentSong(song);
    setQueue([song]);
    setQueueIndex(0);
    setPlayedSongIds(new Set([song.id]));
    loadAndPlay(song);

    // Auto-queue : si le user a liké ce morceau, on enchaîne avec ses autres likes
    if (authUser) {
      (async () => {
        const { data: likeRow } = await supabase
          .from('song_likes').select('id')
          .eq('user_id', authUser.id).eq('song_id', song.id).maybeSingle();
        if (!likeRow) return;
        const { data: allLikes } = await supabase
          .from('song_likes').select('song_id')
          .eq('user_id', authUser.id);
        const otherIds = (allLikes ?? []).map((l) => l.song_id).filter((id) => id !== song.id);
        if (otherIds.length === 0) return;
        const { data: songsData } = await supabase.from('songs').select('*').in('id', otherIds);
        const others = (songsData ?? []) as Song[];
        // shuffle
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        setQueue((q) => (q.length === 1 && q[0].id === song.id ? [song, ...others] : q));
      })();
    }
  }, [loadAndPlay, authUser]);

  const playSongFromList = useCallback((song: Song, list: Song[]) => {
    const idx = Math.max(0, list.findIndex((s) => s.id === song.id));
    setQueue(list);
    setQueueIndex(idx);
    setCurrentSong(song);
    setPlayedSongIds(new Set([song.id]));
    loadAndPlay(song);
  }, [loadAndPlay]);

  const togglePlay = useCallback(() => {
    const a = getActive();
    if (!a || !currentSong) return;
    if (a.paused) a.play().catch(console.error);
    else a.pause();
  }, [currentSong]);

  const findRecommendedSongs = useCallback(async (baseSong: Song): Promise<Song[]> => {
    try {
      const { data } = await supabase.from('songs').select('*').limit(500);
      const all = (data ?? []) as Song[];
      const queueIds = new Set(queue.map((s) => s.id));
      const filtered = all.filter((s) => !playedSongIds.has(s.id) && !queueIds.has(s.id) && s.id !== baseSong.id);
      const sameGenre = filtered
        .filter((s) => s.genre && s.genre === baseSong.genre)
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
  }, [queue, loadAndPlay]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (repeatMode === 'one') { playAtIndex(queueIndex); return; }
    const nextIdx = isShuffled ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') { playAtIndex(0); return; }
      // Auto reco
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
  }, [queue, queueIndex, repeatMode, isShuffled, playAtIndex, currentSong, findRecommendedSongs, loadAndPlay]);

  const previous = useCallback(() => {
    const a = getActive();
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) playAtIndex(prevIdx);
  }, [queueIndex, playAtIndex]);

  // Sync refs avec dernières versions des callbacks
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { triggerCrossfadeRef.current = triggerCrossfade; }, [triggerCrossfade]);

  const seek = useCallback((t: number) => { const a = getActive(); if (a) a.currentTime = t; }, []);
  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleShuffle = useCallback(() => setIsShuffled((s) => !s), []);
  const cycleRepeat = useCallback(() => setRepeatMode((m) => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'), []);
  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
  const setPlaybackRate = useCallback((r: number) => setPlaybackRateState(Math.max(0.5, Math.min(2, r))), []);
  const addToQueue = useCallback((song: Song) => setQueue((q) => [...q, song]), []);

  // Radio: crée une queue infinie depuis un seed
  const startRadio = useCallback(async (seed: Song) => {
    const rec = await findRecommendedSongs(seed);
    const list = [seed, ...rec];
    setQueue(list);
    setQueueIndex(0);
    setCurrentSong(seed);
    setPlayedSongIds(new Set([seed.id]));
    loadAndPlay(seed);
  }, [findRecommendedSongs, loadAndPlay]);

  return (
    <PlayerContext.Provider
      value={{
        currentSong, isPlaying, currentTime, duration, volume,
        queue, queueIndex, isShuffled, repeatMode, isPlayerOpen, playbackRate,
        crossfadeSeconds,
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
