import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { pb, getSongAudioUrl } from '@/lib/pocketbase';
import { showMediaNotification, closeMediaNotification, setupMediaControlListeners } from '@/lib/notifications';
import type { Song } from '@/types/music';

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  playerOpen: boolean;
  likedSongs: Set<string>;
  playSong: (song: Song, autoQueue?: boolean) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setPlayerOpen: (open: boolean) => void;
  toggleLike: (song: Song) => Promise<void>;
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
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const loadingMore = useRef(false);
  const lastProgressRef = useRef(0);

  const incrementPlayCount = useCallback(async (song: Song) => {
    try {
      await pb.collection('songs').update(song.id, { 'playCount+': 1 });
    } catch {
      try {
        await pb.collection('songs').update(song.id, { playCount: (song.playCount || 0) + 1 });
      } catch {
        // ignore
      }
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
      const result = await pb.collection('songs').getList(1, 9, {
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

  const playSong = useCallback(async (song: Song, autoQueue = true) => {
    setCurrentSong(song);
    setPlayerOpen(true);
    audioRef.current.src = getSongAudioUrl(song);
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
    recordListen(song);

    if (autoQueue) {
      try {
        const result = await pb.collection('songs').getList(1, 10, {
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

  const next = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      const nextSong = queue[nextIdx];
      setQueueIndex(nextIdx);
      setCurrentSong(nextSong);
      audioRef.current.src = getSongAudioUrl(nextSong);
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      recordListen(nextSong);

      if (queue.length - nextIdx - 1 <= 1) {
        loadMoreQueue(queue.map(s => s.id));
      }
    }
  }, [queue, queueIndex, loadMoreQueue, recordListen]);

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
      audioRef.current.src = getSongAudioUrl(prevSong);
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [queueIndex]);

  const pause = useCallback(() => { audioRef.current.pause(); setIsPlaying(false); }, []);
  const resume = useCallback(() => { audioRef.current.play().catch(console.error); setIsPlaying(true); }, []);
  const togglePlay = useCallback(() => { isPlaying ? pause() : resume(); }, [isPlaying, pause, resume]);
  const seek = useCallback((time: number) => { audioRef.current.currentTime = time; }, []);

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
    const onTime = () => {
      const currentTime = audio.currentTime;
      if (Math.abs(currentTime - lastProgressRef.current) >= 0.25 || currentTime === 0 || currentTime >= audio.duration) {
        lastProgressRef.current = currentTime;
        setProgress(currentTime);
      }
    };
    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => next();

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('ended', onEnd);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('ended', onEnd);
    };
  }, [next]);

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
    if (!currentSong) {
      closeMediaNotification();
    }
  }, [currentSong]);

  const playerValue = useMemo(() => ({
    currentSong,
    queue,
    isPlaying,
    playerOpen,
    likedSongs,
    playSong,
    pause,
    resume,
    togglePlay,
    next,
    previous,
    seek,
    setPlayerOpen,
    toggleLike,
  }), [currentSong, queue, isPlaying, playerOpen, likedSongs, playSong, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike]);

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
