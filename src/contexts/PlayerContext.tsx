import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { pb, getSongAudioUrl, getSongCoverUrl } from '@/lib/pocketbase';
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
  playSongFromList: (song: Song, list: Song[], index: number, playlistId?: string) => void;
  playCurrentSongOnly: (song: Song) => void;
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
  getImageLoadControl: (songId: string) => { imageKey: string; loadCount: number };
  registerImageLoad: (songId: string) => void;
}

interface PlayerProgressContextType {
  progress: number;
  duration: number;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const PlayerProgressContext = createContext<PlayerProgressContextType | null>(null);

const lastProgressTime = 0;
const progressVelocity = 0;

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
  const [imageLoadCounts, setImageLoadCounts] = useState<Record<string, number>>({});
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
    // Reset load count for new song
    setImageLoadCounts(prev => ({ ...prev, [freshSong.id]: 0 }));
    setQueue(q);
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
    // Reset load count for new song
    setImageLoadCounts(prev => ({ ...prev, [freshSong.id]: 0 }));
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
        const result = await pb.collection('songs').getList(1, 15, {
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
  const playSongFromList = useCallback((song: Song, list: Song[], index: number, playlistId?: string) => {
    setIsFixedQueue(true);
    playSongInternal(song, list, index);
    // Increment playlist playCount if playing from a playlist
    if (playlistId) {
      pb.collection('playlists').update(playlistId, { 'playCount+': 1 }).catch(console.error);
    }
  }, [playSongInternal]);

  // Play single song without auto-queue (fixes playlist add issue)
  const playCurrentSongOnly = useCallback((song: Song) => {
    playSongFromList(song, [song], 0);
  }, [playSongFromList]);

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
      // Reset load count for new song
      setImageLoadCounts(prev => ({ ...prev, [freshNextSong.id]: 0 }));
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
        // Reset load count for new song
        setImageLoadCounts(prev => ({ ...prev, [freshPrevSong.id]: 0 }));
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

  const pause = useCallback(() => { 
    audioRef.current.pause(); 
    setIsPlaying(false);
    if (currentSong) {
      showMediaNotification(currentSong, false, likedSongs.has(currentSong.id));
    }
  }, [currentSong, likedSongs]);

  const resume = useCallback(() => { 
    audioRef.current.play().catch(console.error); 
    setIsPlaying(true);
    if (currentSong) {
      showMediaNotification(currentSong, true, likedSongs.has(currentSong.id));
    }
  }, [currentSong, likedSongs]);
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);
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

        // Add to "Titres likés" auto-playlist
        try {
          let likedPlaylist = await pb.collection('playlists').getList(1, 1, {
            filter: `owner="${userId}" && title="Titres likés"`,
          });

          if (likedPlaylist.items.length === 0) {
            // Create the auto-playlist if it doesn't exist
            likedPlaylist = await pb.collection('playlists').create({
              title: 'Titres likés',
              description: 'Vos morceaux favoris automatiquement ajoutés',
              public: false,
              owner: userId,
              songs: [song.id],
              viewCount: 0,
              playCount: 0,
              likesCount: 0,
              thumbnailMode: 'grid',
            });
          } else {
            // Add song to existing playlist if not already there
            const playlist = likedPlaylist.items[0];
            if (!playlist.songs.includes(song.id)) {
              await pb.collection('playlists').update(playlist.id, {
                'songs+': song.id,
              });
            }
          }
        } catch (playlistError) {
          console.error('Error updating liked playlist:', playlistError);
        }
      }
      // Force update count on the server side
      const currentLikesCount = song.likesCount || 0;
      await pb.collection('songs').update(song.id, {
        likesCount: isCurrentlyLiked ? Math.max(0, currentLikesCount - 1) : currentLikesCount + 1,
      });
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
        const likedIds = new Set<string>(likes.map((like: any) => like.song));
        setLikedSongs(likedIds);
      } catch (error) {
        console.error('Error loading liked songs:', error);
      }
    };
    loadLikedSongs();
  }, []);

  // Load image load counts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jux_imageLoadCounts');
      if (saved) {
        setImageLoadCounts(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage when counts change
  useEffect(() => {
    try {
      localStorage.setItem('jux_imageLoadCounts', JSON.stringify(imageLoadCounts));
    } catch {
      // Ignore storage errors
    }
  }, [imageLoadCounts]);

  useEffect(() => {
    const audio = audioRef.current;

    if ('mediaSession' in navigator && currentSong) {
      const coverUrl = getSongCoverUrl(currentSong);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.expand?.uploadedBy?.pseudo || currentSong.author || 'Unknown Artist',
        album: 'Jux Music Hub',
        artwork: [
          { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('previoustrack', () => previous());

      // Show media notification with cover image
      showMediaNotification(currentSong, isPlaying, likedSongs.has(currentSong.id));
    }

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

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
    };

    // Fix Chrome mobile: handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden && audio.duration && audio.currentTime >= audio.duration - 0.5) {
        // Page became visible and song is near the end
        onEnd();
      }
    };

    // Fallback: check periodically if song ended (for mobile background)
    const checkInterval = setInterval(() => {
      if (audio.duration && audio.currentTime >= audio.duration - 0.1) {
        onEnd();
      }
    }, 1000);

    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(checkInterval);
    };
  }, [currentSong, next, previous, pause, resume]);






  const registerImageLoad = useCallback((songId: string) => {
    setImageLoadCounts(prev => {
      const currentCount = prev[songId] || 0;
      const newCount = Math.min(currentCount + 1, 5);
      return { ...prev, [songId]: newCount };
    });
  }, []);

  const getImageLoadControl = useCallback((songId: string) => {
    const loadCount = imageLoadCounts[songId] || 0;
    const imageKey = loadCount < 5 ? songId : `stable-${songId}`;
    return { imageKey, loadCount };
  }, [imageLoadCounts]);

  const playerValue = useMemo(() => ({
    currentSong, queue, isPlaying, isLoading, playerOpen, likedSongs, shuffle, repeatMode,
    playSong, playSongFromList, playCurrentSongOnly, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike, toggleShuffle, cycleRepeat,
    getImageLoadControl, registerImageLoad,
  }), [currentSong, queue, isPlaying, isLoading, playerOpen, likedSongs, shuffle, repeatMode, playSong, playSongFromList, playCurrentSongOnly, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike, toggleShuffle, cycleRepeat, getImageLoadControl, registerImageLoad]);

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
