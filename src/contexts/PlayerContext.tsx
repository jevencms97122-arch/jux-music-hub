import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { pb, getSongAudioUrl, getSongCoverUrl } from '@/lib/pocketbase';
import { showMediaNotification, closeMediaNotification, setupMediaControlListeners, clearMediaControlListeners, updateMediaPosition } from '@/lib/notifications';
import { updateStreak } from '@/lib/streaks';
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
  playbackRate: number;
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
  setPlaybackRate: (rate: number) => void;
  getImageLoadControl: (songId: string) => { imageKey: string; loadCount: number };
  registerImageLoad: (songId: string) => void;
  radioMode: boolean;
  toggleRadioMode: () => void;
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
  const [imageLoadCounts, setImageLoadCounts] = useState<Record<string, number>>({});
  const [radioMode, setRadioMode] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // Single audio element - no ref swapping
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadingMore = useRef(false);
  const isLoadingRef = useRef(false);
  const crossfadeActive = useRef(false);
  const crossfadeTimer = useRef<number | null>(null);
  const preloadedNextSong = useRef<Song | null>(null);
  const preloadedNextIdx = useRef<number>(-1);
  
  const CROSSFADE_DURATION = 3000; // 3s crossfade
  const PRELOAD_THRESHOLD = 10; // preload 10s before end

  // Initialize audio elements
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 1;
    (audio as any).preservesPitch = false;
    (audio as any).mozPreservesPitch = false;
    (audio as any).webkitPreservesPitch = false;
    audioRef.current = audio;

    const nextAudio = new Audio();
    nextAudio.preload = 'auto';
    nextAudio.volume = 0;
    (nextAudio as any).preservesPitch = false;
    (nextAudio as any).mozPreservesPitch = false;
    (nextAudio as any).webkitPreservesPitch = false;
    nextAudioRef.current = nextAudio;

    return () => {
      audio.pause();
      audio.src = '';
      nextAudio.pause();
      nextAudio.src = '';
      if (crossfadeTimer.current) cancelAnimationFrame(crossfadeTimer.current);
    };
  }, []);

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

  // Update media notification whenever song or playback state changes
  const updateNotification = useCallback((song: Song | null, playing: boolean, liked: Set<string>) => {
    if (!song) return;
    if (radioMode) {
      closeMediaNotification();
      clearMediaControlListeners();
    } else {
      showMediaNotification(song, playing, liked.has(song.id));
    }
  }, [radioMode]);

  // Core play function - handles loading a song into the main audio
  const loadAndPlay = useCallback(async (song: Song, newQueue: Song[], idx: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Cancel any active crossfade
    if (crossfadeTimer.current) {
      cancelAnimationFrame(crossfadeTimer.current);
      crossfadeTimer.current = null;
    }
    crossfadeActive.current = false;
    
    // Stop next audio if playing
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.volume = 0;
      nextAudioRef.current.src = '';
    }

    // Fetch fresh song data
    let freshSong: Song;
    try {
      freshSong = await pb.collection('songs').getOne(song.id, { expand: 'uploadedBy' }) as unknown as Song;
    } catch {
      freshSong = song;
    }

    // Reset state
    setImageLoadCounts(prev => ({ ...prev, [freshSong.id]: 0 }));
    setQueue(newQueue);
    setCurrentSong(freshSong);
    setQueueIndex(idx);
    setPlayerOpen(true);
    isLoadingRef.current = true;
    setIsLoading(true);
    preloadedNextSong.current = null;
    preloadedNextIdx.current = -1;

    // Switch song - NO transition when not in radio mode
    const switchSong = () => {
      if (radioMode && audio.src && !audio.paused) {
        // Only fade out when in RADIO MODE
        const startVol = audio.volume;
        const fadeStart = performance.now();
        const fadeOut = (time: number) => {
          const elapsed = time - fadeStart;
          const progress = Math.min(elapsed / 200, 1);
          audio.volume = startVol * (1 - progress);
          if (progress < 1) {
            requestAnimationFrame(fadeOut);
          } else {
            audio.pause();
            // 🔧 CORRECTION: Conserver le volume utilisateur au lieu de remettre a 1
            audio.volume = startVol;
            audio.src = getSongAudioUrl(freshSong);
            audio.playbackRate = playbackRate;
            audio.load();
          }
        };
        requestAnimationFrame(fadeOut);
      } else {
        // NORMAL MODE: direct change, NO TRANSITION AT ALL
        if (!audio.paused) {
          audio.pause();
        }
        // 🔧 CORRECTION: Conserver le volume utilisateur au lieu de remettre a 1
        audio.volume = audio.volume;
        audio.src = getSongAudioUrl(freshSong);
        audio.playbackRate = playbackRate;
        audio.load();
      }
    };

    switchSong();
    recordListen(freshSong);
  }, [recordListen, playbackRate]);

  const playSong = useCallback(async (song: Song, autoQueue = true) => {
    setIsFixedQueue(false);
    
    if (autoQueue) {
      try {
        const result = await pb.collection('songs').getList(1, 15, {
          sort: '@random',
          filter: `id!="${song.id}"`,
          expand: 'uploadedBy',
        });
        const newQueue = [song, ...(result.items as unknown as Song[])];
        await loadAndPlay(song, newQueue, 0);
      } catch {
        await loadAndPlay(song, [song], 0);
      }
    } else {
      await loadAndPlay(song, [song], 0);
    }
  }, [loadAndPlay]);

  const playSongFromList = useCallback((song: Song, list: Song[], index: number, playlistId?: string) => {
    setIsFixedQueue(true);
    loadAndPlay(song, list, index);
    if (playlistId) {
      pb.collection('playlists').update(playlistId, { 'playCount+': 1 }).catch(console.error);
    }
  }, [loadAndPlay]);

  const playCurrentSongOnly = useCallback((song: Song) => {
    playSongFromList(song, [song], 0);
  }, [playSongFromList]);

  const getNextIndex = useCallback(() => {
    if (repeatMode === 'one') return queueIndex;
    
    if (shuffle) {
      const candidates = Array.from({ length: queue.length }, (_, i) => i).filter(i => i !== queueIndex);
      if (candidates.length === 0) return -1;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    
    const nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      return repeatMode === 'all' ? 0 : -1;
    }
    return nextIdx;
  }, [queue, queueIndex, shuffle, repeatMode]);

  const next = useCallback(async () => {
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      }
      return;
    }

    const nextIdx = getNextIndex();
    if (nextIdx < 0 || !queue[nextIdx]) return;

    await loadAndPlay(queue[nextIdx], queue, nextIdx);

    // Auto-load more for non-fixed queues
    if (!isFixedQueue && queue.length - nextIdx - 1 <= 5) {
      loadMoreQueue(queue.map(s => s.id));
    }
  }, [queue, queueIndex, loadAndPlay, getNextIndex, loadMoreQueue, isFixedQueue, repeatMode]);

  const previous = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (queueIndex > 0) {
      await loadAndPlay(queue[queueIndex - 1], queue, queueIndex - 1);
    }
  }, [queueIndex, queue, loadAndPlay]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setIsPlaying(false);
    updateNotification(currentSong, false, likedSongs);
  }, [currentSong, likedSongs, updateNotification]);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.play().catch(console.error);
    setIsPlaying(true);
    updateNotification(currentSong, true, likedSongs);
  }, [currentSong, likedSongs, updateNotification]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause(); else resume();
  }, [isPlaying, pause, resume]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
  }, []);

  const toggleShuffle = useCallback(() => setShuffle(p => !p), []);
  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);
  const toggleRadioMode = useCallback(() => setRadioMode(p => !p), []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (nextAudioRef.current) nextAudioRef.current.playbackRate = rate;
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

        try {
          let likedPlaylist = await pb.collection('playlists').getList(1, 1, {
            filter: `owner="${userId}" && title="Titres likés"`,
          });
          if (likedPlaylist.items.length === 0) {
            await pb.collection('playlists').create({
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
            const playlist = likedPlaylist.items[0];
            if (!playlist.songs.includes(song.id)) {
              await pb.collection('playlists').update(playlist.id, { 'songs+': song.id });
            }
          }
        } catch (playlistError) {
          console.error('Error updating liked playlist:', playlistError);
        }
      }
      const currentLikesCount = song.likesCount || 0;
      await pb.collection('songs').update(song.id, {
        likesCount: isCurrentlyLiked ? Math.max(0, currentLikesCount - 1) : currentLikesCount + 1,
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [likedSongs]);

  // Load liked songs on mount
  useEffect(() => {
    const loadLikedSongs = async () => {
      if (!pb.authStore.record) return;
      try {
        const likes = await pb.collection('song_likes').getFullList({
          filter: `user="${pb.authStore.record.id}"`,
        });
        setLikedSongs(new Set<string>(likes.map((like: any) => like.song)));
      } catch (error) {
        console.error('Error loading liked songs:', error);
      }
    };
    loadLikedSongs();
  }, []);

  // Preload next song
  const preloadNextSong = useCallback(() => {
    if (repeatMode === 'one' || crossfadeActive.current || preloadedNextSong.current) return;
    
    const nextIdx = getNextIndex();
    if (nextIdx < 0 || !queue[nextIdx] || !nextAudioRef.current) return;

    const nextSong = queue[nextIdx];
    preloadedNextSong.current = nextSong;
    preloadedNextIdx.current = nextIdx;
    nextAudioRef.current.src = getSongAudioUrl(nextSong);
    nextAudioRef.current.playbackRate = playbackRate;
    nextAudioRef.current.load();
  }, [queue, getNextIndex, repeatMode, playbackRate]);

    // Crossfade to next song
    const performCrossfade = useCallback(async (nextSong: Song, nextIdx: number) => {
      if (crossfadeActive.current || !audioRef.current || !nextAudioRef.current) return;
      crossfadeActive.current = true;

      let freshNextSong: Song;
      try {
        freshNextSong = await pb.collection('songs').getOne(nextSong.id, { expand: 'uploadedBy' }) as unknown as Song;
      } catch {
        freshNextSong = nextSong;
      }

      // Update state for new song
      setQueueIndex(nextIdx);
      setCurrentSong(freshNextSong);
      setImageLoadCounts(prev => ({ ...prev, [freshNextSong.id]: 0 }));
      recordListen(freshNextSong);

      // Start next audio
      const nextAudio = nextAudioRef.current;
      const mainAudio = audioRef.current;
      // ✅ CORRECTION: Sauvegarder le volume actuel de l'utilisateur avant le crossfade
      const userVolume = mainAudio.volume;
      nextAudio.play().catch(console.error);

      const startTime = performance.now();
      
      const fade = (time: number) => {
        const elapsed = time - startTime;
        const t = Math.min(elapsed / CROSSFADE_DURATION, 1);
        // Ease in-out curve
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        // ✅ CORRECTION: Utiliser le vrai volume utilisateur comme maximum, pas 1
        mainAudio.volume = userVolume * (1 - ease);
        nextAudio.volume = userVolume * ease;
        
        // Update progress from the new audio
        setProgress(nextAudio.currentTime);
        setDuration(nextAudio.duration || 0);
        
        if (t < 1) {
          crossfadeTimer.current = requestAnimationFrame(fade);
        } else {
          // Crossfade complete - swap audio elements
        mainAudio.pause();
        mainAudio.src = '';
        // ✅ CORRECTION: Remettre exactement le volume utilisateur
        mainAudio.volume = userVolume;
        // ✅ CORRECTION: Appliquer aussi la vitesse de lecture sur l'audio principal
        mainAudio.playbackRate = playbackRate;
        
        // Swap refs
        const temp = audioRef.current;
        audioRef.current = nextAudioRef.current;
        nextAudioRef.current = temp;
        
        // ✅ FORCER la vitesse sur le NOUVEL audio principal APRÈS l'échange
        audioRef.current.playbackRate = playbackRate;
          
          // Reset next audio
          if (nextAudioRef.current) {
            nextAudioRef.current.volume = 0;
            nextAudioRef.current.src = '';
          }
          
          preloadedNextSong.current = null;
          preloadedNextIdx.current = -1;
          crossfadeActive.current = false;
          crossfadeTimer.current = null;
          
          setIsLoading(false);
          isLoadingRef.current = false;

          // Update notification with new song
          showMediaNotification(freshNextSong, true, likedSongs.has(freshNextSong.id));

          // Auto-load more
          if (!isFixedQueue && queue.length - nextIdx - 1 <= 5) {
            loadMoreQueue(queue.map(s => s.id));
          }
        }
      };
      
      crossfadeTimer.current = requestAnimationFrame(fade);
    }, [recordListen, loadMoreQueue, isFixedQueue, likedSongs, queue, CROSSFADE_DURATION, playbackRate]);

  // Main audio event listeners - re-attach whenever audio element changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onDuration = () => setDuration(audio.duration || 0);
    
    const onCanPlay = () => {
      if (isLoadingRef.current) {
        audio.play().catch(console.error);
        setIsPlaying(true);
        setIsLoading(false);
        isLoadingRef.current = false;
        
        // Update notification once playing
        if (currentSong && !radioMode) {
          showMediaNotification(currentSong, true, likedSongs.has(currentSong.id));
        }
      }
    };

    const onEnded = () => {
      if (crossfadeActive.current) return;
      
      // Full listen = update streak
      if (pb.authStore.record) {
        updateStreak(pb.authStore.record.id).catch(console.error);
      }
      next().catch(console.error);
    };

    const onTimeUpdate = () => {
      if (crossfadeActive.current) return;
      
      setProgress(audio.currentTime);
      
      if (audio.duration && !crossfadeActive.current) {
        const remaining = audio.duration - audio.currentTime;
        
        // Preload next song (RADIO MODE ONLY)
        if (radioMode && remaining <= PRELOAD_THRESHOLD && !preloadedNextSong.current) {
          preloadNextSong();
        }
        
        // Start crossfade (RADIO MODE ONLY)
        if (radioMode && remaining <= CROSSFADE_DURATION / 1000 && preloadedNextSong.current && preloadedNextIdx.current >= 0) {
          performCrossfade(preloadedNextSong.current, preloadedNextIdx.current);
        }
        
        // Update position state for lock screen scrubber
        if (!radioMode) {
          updateMediaPosition(audio.currentTime, audio.duration, playbackRate);
        }
      }
    };

    const onError = (e: Event) => {
      console.error('Audio error:', e);
      setIsLoading(false);
      isLoadingRef.current = false;
    };

    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
    };
  }, [currentSong, next, preloadNextSong, performCrossfade, radioMode, likedSongs, playbackRate]);

  // Setup MediaSession controls
  useEffect(() => {
    if (radioMode) {
      closeMediaNotification();
      clearMediaControlListeners();
    } else if (currentSong) {
      setupMediaControlListeners({
        onPlay: () => resume(),
        onPause: () => pause(),
        onNext: () => next(),
        onPrevious: () => previous(),
        onSeekBackward: () => {
          const audio = audioRef.current;
          if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
        },
        onSeekForward: () => {
          const audio = audioRef.current;
          if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
        },
      });
    }
  }, [currentSong, radioMode, resume, pause, next, previous]);

  // Image load control
  const registerImageLoad = useCallback((songId: string) => {
    setImageLoadCounts(prev => ({
      ...prev,
      [songId]: Math.min((prev[songId] || 0) + 1, 5),
    }));
  }, []);

  const getImageLoadControl = useCallback((songId: string) => {
    const loadCount = imageLoadCounts[songId] || 0;
    return { imageKey: loadCount < 5 ? songId : `stable-${songId}`, loadCount };
  }, [imageLoadCounts]);

  const playerValue = useMemo(() => ({
    currentSong, queue, isPlaying, isLoading, playerOpen, likedSongs, shuffle, repeatMode, radioMode, playbackRate,
    playSong, playSongFromList, playCurrentSongOnly, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike, toggleShuffle, cycleRepeat, toggleRadioMode, setPlaybackRate,
    getImageLoadControl, registerImageLoad,
  }), [currentSong, queue, isPlaying, isLoading, playerOpen, likedSongs, shuffle, repeatMode, radioMode, playbackRate, playSong, playSongFromList, playCurrentSongOnly, pause, resume, togglePlay, next, previous, seek, setPlayerOpen, toggleLike, toggleShuffle, cycleRepeat, toggleRadioMode, setPlaybackRate, getImageLoadControl, registerImageLoad]);

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
