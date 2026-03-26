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

let lastProgressTime = 0;
let progressVelocity = 0;

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
    // Backend only - no local optimistic update
    // Background DB sync
    if (pb.authStore.record) {
      pb.collection('listen_history').create({
        user: pb.authStore.record.id,
        song: song.id,
        listenedAt: new Date().toISOString(),
      }).catch(console.error);
    }
    incrementPlayCount(song).catch(console.error);
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

  const playSongInternal = useCallback(async (song: Song, q: Song[], idx: number) => {
    // Fetch fresh song data from backend
    const freshSong = await pb.collection('songs').getOne(song.id, { expand: 'uploadedBy' }) as unknown as Song;
    setCurrentSong(freshSong);
    setPlayerOpen(true);
    isLoadingRef.current = true;
    setIsLoading(true);
    audioRef.current.src = getSongAudioUrl(freshSong);
    audioRef.current.load();
    setQueueIndex(idx);
    await recordListen(freshSong);
  }, [recordListen]);

  const playSong = useCallback(async (song: Song, autoQueue = true) => {
    // Fetch fresh song data from backend
    const freshSong = await pb.collection('songs').getOne(song.id, { expand: 'uploadedBy' }) as unknown as Song;
    setIsFixedQueue(false);
    setCurrentSong(freshSong);
    setPlayerOpen(true);
    isLoadingRef.current = true;
    setIsLoading(true);
    audioRef.current.src = getSongAudioUrl(freshSong);
    audioRef.current.load();
    await recordListen(freshSong);

    if (autoQueue) {
      try {
        const result = await pb.collection('songs').getList(1, 30, {
          sort: '@random',
          filter: `id!="${freshSong.id}"`,
          expand: 'uploadedBy',
        });
        setQueue([freshSong, ...(result.items as unknown as Song[])]);
        setQueueIndex(0);
      } catch {
        setQueue([freshSong]);
        setQueueIndex(0);
      }
    }
  }, [recordListen]);

  // Play from a fixed list (e.g. Favorites) — no random loading
  const playSongFromList = useCallback((song: Song, list: Song[], index: number) => {
    setIsFixedQueue(true);
    playSongInternal(song, list, index);
  }, [playSongInternal]);

  const next = useCallback(async () => {
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

    try {
      // Fetch fresh nextSong
      const freshNextSong = await pb.collection('songs').getOne(queue[nextIdx].id, { expand: 'uploadedBy' }) as unknown as Song;
      setQueueIndex(nextIdx);
      setCurrentSong(freshNextSong);
      isLoadingRef.current = true;
      setIsLoading(true);
      audioRef.current.src = getSongAudioUrl(freshNextSong);
      audioRef.current.load();
      await recordListen(freshNextSong);

      // Auto-load more only for non-fixed queues
      if (!isFixedQueue && queue.length - nextIdx - 1 <= 5) {
        loadMoreQueue(queue.map(s => s.id));
      }
    } catch (error) {
      console.error('Error playing next song:', error);
    }
  }, [queue, queueIndex, loadMoreQueue, recordListen, shuffle, repeatMode, isFixedQueue]);

  const previous = useCallback(async () => {
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queueIndex > 0) {
      try {
        const prevIdx = queueIndex - 1;
        // Fetch fresh prevSong
        const freshPrevSong = await pb.collection('songs').getOne(queue[prevIdx].id, { expand: 'uploadedBy' }) as unknown as Song;
        setQueueIndex(prevIdx);
        setCurrentSong(freshPrevSong);
        isLoadingRef.current = true;
        setIsLoading(true);
        audioRef.current.src = getSongAudioUrl(freshPrevSong);
        audioRef.current.load();
        await recordListen(freshPrevSong);
      } catch (error) {
        console.error('Error playing previous song:', error);
      }
    }
  }, [queueIndex, queue, recordListen]);

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
      const now = performance.now();
      const currentTime = audio.currentTime;
      
      // Calculate velocity
      if (lastProgressTime > 0) {
        const deltaTime = now - lastProgressTime;
        const deltaProgress = currentTime - lastProgressRef.current;
        progressVelocity = deltaProgress / (deltaTime / 1000);
      }
      lastProgressTime = now;
      
      if (Math.abs(currentTime - lastProgressRef.current) >= 0.016 || currentTime === 0 || currentTime >= audio.duration) {
        lastProgressRef.current = currentTime;
        setProgress(currentTime);
      }
      
      // Auto-next if near end and stalled (backup for mobile suspend)
      if (audio.duration > 0 && currentTime / audio.duration > 0.95 && progressVelocity < 0.1 && isPlaying) {
        next().catch(console.error);
        return;
      }
      
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => next().catch(console.error);
    const onCanPlay = () => {
      if (isLoadingRef.current) {
        audio.play().catch(console.error);
        setIsPlaying(true);
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };
    
    // Timeupdate for near-end check
    const onTimeUpdate = () => {
      if (audio.duration > 0 && audio.currentTime / audio.duration > 0.98 && progressVelocity < 0.05) {
        next().catch(console.error);
      }
    };

    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);

    // Start animation frame loop when playing
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [next, isPlaying]);






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
