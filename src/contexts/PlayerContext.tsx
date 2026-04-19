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
  addToQueue: (song: Song) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { authUser } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Init audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    (audio as any).preservesPitch = false;
    (audio as any).mozPreservesPitch = false;
    (audio as any).webkitPreservesPitch = false;
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => handleEnded();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      clearMediaSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync volume + rate
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate]);

  // MediaSession metadata + handlers
  useEffect(() => {
    setMediaSessionMetadata(currentSong);
  }, [currentSong]);

  useEffect(() => {
    setMediaSessionHandlers({
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      next: () => next(),
      previous: () => previous(),
      seek: (t) => seek(t),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, queueIndex, repeatMode, isShuffled]);

  useEffect(() => {
    setMediaSessionPosition(duration, currentTime, playbackRate);
  }, [duration, currentTime, playbackRate]);

  const loadAndPlay = useCallback(async (song: Song) => {
    if (!audioRef.current) return;
    audioRef.current.src = songAudioUrl(song);
    audioRef.current.playbackRate = playbackRate;
    try {
      await audioRef.current.play();
      // Increment play_count + log history + streak
      if (authUser) {
        await supabase.from('listen_history').insert({ user_id: authUser.id, song_id: song.id });
        await supabase.rpc('increment_play_count' as any, { song_id_input: song.id }).catch(() => {
          // RPC absente : fallback en update manuel
          supabase
            .from('songs')
            .update({ play_count: (song.play_count ?? 0) + 1 })
            .eq('id', song.id);
        });
        updateStreak(authUser.id);
      }
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }, [authUser, playbackRate]);

  const playSong = useCallback((song: Song) => {
    setCurrentSong(song);
    setQueue([song]);
    setQueueIndex(0);
    loadAndPlay(song);
  }, [loadAndPlay]);

  const playSongFromList = useCallback((song: Song, list: Song[]) => {
    const idx = Math.max(0, list.findIndex((s) => s.id === song.id));
    setQueue(list);
    setQueueIndex(idx);
    setCurrentSong(song);
    loadAndPlay(song);
  }, [loadAndPlay]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentSong) return;
    if (audioRef.current.paused) audioRef.current.play().catch(console.error);
    else audioRef.current.pause();
  }, [currentSong]);

  const playAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= queue.length) return;
    const song = queue[idx];
    setQueueIndex(idx);
    setCurrentSong(song);
    loadAndPlay(song);
  }, [queue, loadAndPlay]);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (repeatMode === 'one') { playAtIndex(queueIndex); return; }
    let nextIdx = isShuffled ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') nextIdx = 0;
      else { audioRef.current?.pause(); return; }
    }
    playAtIndex(nextIdx);
  }, [queue, queueIndex, repeatMode, isShuffled, playAtIndex]);

  const previous = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) playAtIndex(prevIdx);
  }, [queueIndex, playAtIndex]);

  const handleEnded = useCallback(() => { next(); }, [next]);

  const seek = useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
  }, []);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);
  const toggleShuffle = useCallback(() => setIsShuffled((s) => !s), []);
  const cycleRepeat = useCallback(() => setRepeatMode((m) => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'), []);
  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
  const setPlaybackRate = useCallback((r: number) => setPlaybackRateState(Math.max(0.5, Math.min(2, r))), []);
  const addToQueue = useCallback((song: Song) => setQueue((q) => [...q, song]), []);

  return (
    <PlayerContext.Provider
      value={{
        currentSong, isPlaying, currentTime, duration, volume,
        queue, queueIndex, isShuffled, repeatMode, isPlayerOpen, playbackRate,
        playSong, playSongFromList, togglePlay, next, previous, seek, setVolume,
        toggleShuffle, cycleRepeat, openPlayer, closePlayer, setPlaybackRate, addToQueue,
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
