import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { pb, getSongAudioUrl } from '@/lib/pocketbase';
import { showMediaNotification, closeMediaNotification, setupMediaControlListeners } from '@/lib/notifications';
import type { Song } from '@/types/music';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  isLoading: boolean;
  playerOpen: boolean;
  likedSongs: Set<string>;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playSong: (song: Song, autoQueue?: boolean) => void;
  playSongFromList: (song: Song, list: Song[], index: number) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setPlayerOpen: (open: boolean) => void;
  toggleLike: (song: Song) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

interface PlayerProgressContextType {
  progress: number;
  duration: number;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const PlayerProgressContext = createContext<PlayerProgressContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isFixedQueue, setIsFixedQueue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  
  // Set preload to none for progressive loading
  useEffect(() => {
    audioRef.current.preload = 'none';
  }, []);
  const loadingMore = useRef(false);
  const lastProgressRef = useRef(0);
  const isLoadingRef = useRef(false);

  const incrementPlayCount = useCallback(async (song: Song) => {
    try {
      await pb.collection('songs').update(song.id, { 'playCount+': 1 });
    } catch {
      try {
        await pb.collection('songs').update(song.id, { playCount: (song.playCount || 0) + 1 });
      } catch { /* ignore */ }
    }
  }, []);

  const recordListen = useCallback((song: Song) => {
    if (pb.authStore.record) {
      pb.collection('listen_history').create({
        user: pb.authStore.record.id,
        song: song.id,
        listenedAt: new Date().toISOString(),
      }).catch(console.error);
    }
    incrementPlayCount(song);
  }, [incrementPlayCount]);

  const loadMoreQueue = useCallback(async (exclude: string[]) => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    try {
      const result = await pb.collection('songs').getList(1, 20, {
        sort: '@random',
        filter: exclude.length ? exclude.map(id => `id!="${id}"`).join('&&') : '',
        expand: 'uploadedBy',
      });
      setQueue(prev => [...prev, ...(result.items as unknown as Song[])]);
    } catch (e) {
      console.error('Failed to load queue', e);
    } finally {
      loadingMore.current = false;
    }
  }, []);

  const playSongInternal = useCallback((song: Song, q: Song[], idx: number) => {
    setCurrentSong(song);
    setPlayerOpen(true);
    isLoadingRef.current = true;
    setIsLoading(true);
    audioRef.current.src = getSongAudioUrl(song);
    audioRef.current.load(); // Start loading with preload='none'
    setQueue(q);
    setQueueIndex(idx);
    recordListen(song);
  }, [recordListen]);

  const playSong = useCallback(async (song: Song, autoQueue = true) => {
    setIsFixedQueue(false);
    setCurrentSong(song);
    setPlayerOpen(true);
    isLoadingRef.current = true;
    setIsLoading(true);
    audioRef.current.src = getSongAudioUrl(song);
    audioRef.current.load(); // Start loading with preload='none'
    recordListen(song);

    if (autoQueue) {
      try {
        const result = await pb.collection('songs').getList(1, 30, {
          sort: '@random',
          filter: `id!="${song.id}"`,
          expand: 'uploadedBy',
        });
        setQueue([song, ...(result.items as unknown as Song[])]);
        setQueueIndex(0);
      } catch {
        setQueue([song]);
        setQueueIndex(0);
      }
    }
  }, [recordListen]);

  // Play from a fixed list (e.g. Favorites) — no random loading
  const playSongFromList = useCallback((song: Song, list: Song[], index: number) => {
    setIsFixedQueue(true);
    playSongInternal(song, list, index);
  }, [playSongInternal]);

  const next = useCallback(() => {
    if (queue.length === 0) return;

    // Repeat one: restart current song
    if (repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
      return;
    }

    let nextIdx: number;
    if (shuffle) {
      // Pick a random index that's not the current one
      const candidates = Array.from({ length: queue.length }, (_, i) => i).filter(i => i !== queueIndex);
      if (candidates.length === 0) return;
      nextIdx = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      nextIdx = queueIndex + 1;
    }

    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        return; // End of queue
      }
    }

    const nextSong = queue[nextIdx];
    setQueueIndex(nextIdx);
    setCurrentSong(nextSong);
    isLoadingRef.current = true;
    setIsLoading(true);
    audioRef.current.src = getSongAudioUrl(nextSong);
    audioRef.current.load(); // Start loading
    recordListen(nextSong);

    // Auto-load more only for non-fixed queues
    if (!isFixedQueue && queue.length - nextIdx - 1 <= 5) {
      loadMoreQueue(queue.map(s => s.id));
    }
  }, [queue, queueIndex, loadMoreQueue, recordListen, shuffle, repeatMode, isFixedQueue]);

  const previous = useCallback(() => {
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      const prevSong = queue[prevIdx];
      setQueueIndex(prevIdx);
      setCurrentSong(prevSong);
      isLoadingRef.current = true;
      setIsLoading(true);
      audioRef.current.src = getSongAudioUrl(prevSong);
      audioRef.current.load(); // Start loading
    }
  }, [queueIndex, queue]);

  const pause = useCallback(() => { audioRef.current.pause(); setIsPlaying(false); }, []);
  const resume = useCallback(() => { audioRef.current.play().catch(console.error); setIsPlaying(true); }, []);
  const togglePlay = useCallback(() => { isPlaying ? pause() : resume(); }, [isPlaying, pause, resume]);
  const seek = useCallback((time: number) => { audioRef.current.currentTime = time; }, []);
  const toggleShuffle = useCallback(() => setShuffle(p => !p), []);
  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

  const toggleLike = useCallback(async (song: Song) => {
    if (!pb.authStore.record) return;
    const userId = pb.authStore.record.id;
    const isCurrentlyLiked = likedSongs.has(song.id);

    try {
      if (isCurrentlyLiked) {
        const likes = await pb.collection('song_likes').getFullList({
          filter: `user="${userId}" && song="${song.id}"`,
        });
        for (const like of likes) {
          await pb.collection('song_likes').delete(like.id);
        }
        setLikedSongs(prev => {
          const newSet = new Set(prev);
          newSet.delete(song.id);
          return newSet;
        });
      } else {
        await pb.collection('song_likes').create({ user: userId, song: song.id });
        setLikedSongs(prev => new Set(prev).add(song.id));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [likedSongs]);

  useEffect(() => {
    const loadLikedSongs = async () => {
      if (!pb.authStore.record) return;
      try {
        const likes = await pb.collection('song_likes').getFullList({
          filter: `user="${pb.authStore.record.id}"`,
        });
        const likedIds = new Set(likes.map((like: any) => like.song));
        setLikedSongs(likedIds);
      } catch (error) {
        console.error('Error loading liked songs:', error);
      }
    };
    loadLikedSongs();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    let animationFrameId: number;
    
    const updateProgress = () => {
      const currentTime = audio.currentTime;
      if (Math.abs(currentTime - lastProgressRef.current) >= 0.016 || currentTime === 0 || currentTime >= audio.duration) {
        lastProgressRef.current = currentTime;
        setProgress(currentTime);
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => next();
    const onCanPlay = () => {
      if (isLoadingRef.current) {
        audio.play().catch(console.error);
        setIsPlaying(true);
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('canplay', onCanPlay);

    // Start animation frame loop when playing
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('canplay', onCanPlay);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [next, isPlaying]);

  useEffect(() => {
    setupMediaControlListeners({
      onPlay: () => { audioRef.current.play().catch(console.error); setIsPlaying(true); },
      onPause: () => { audioRef.current.pause(); setIsPlaying(false); },
      onNext: () => next(),
      onPrevious: () => previous(),
      onLike: () => { if (currentSong) toggleLike(currentSong); },
    });
  }, [currentSong, next, previous, toggleLike]);

  useEffect(() => {
    if (currentSong && isPlaying) {
      showMediaNotification(currentSong, true, likedSongs.has(currentSong.id));
    } else if (!isPlaying && currentSong) {
      showMediaNotification(currentSong, false, likedSongs.has(currentSong.id));
    }
  }, [currentSong, isPlaying, likedSongs]);

  useEffect(() => {
    if (!currentSong) closeMediaNotification();
  }, [currentSong]);

  const playerValue = useMemo(() => ({
    currentSong, queue, isPlaying, isLoading, playerOpen, likedSongs, shuffle, repeatMode,
    playSong, playSongFromList, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike, toggleShuffle, cycleRepeat,
  }), [currentSong, queue, isPlaying, isLoading, playerOpen, likedSongs, shuffle, repeatMode, playSong, playSongFromList, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike, toggleShuffle, cycleRepeat]);

  const progressValue = useMemo(() => ({ progress, duration }), [progress, duration]);

  return (
    <PlayerContext.Provider value={playerValue}>
      <PlayerProgressContext.Provider value={progressValue}>
        {children}
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
}

export function usePlayerProgress() {
  const ctx = useContext(PlayerProgressContext);
  if (!ctx) throw new Error('usePlayerProgress must be inside PlayerProvider');
  return ctx;
}
