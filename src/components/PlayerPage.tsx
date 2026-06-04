import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '@/lib/pocketbase';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Share2, MoreHorizontal,
  UserPlus, User, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, ChevronDown, Music2, Wifi, WifiOff, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Song } from '@/types/music';
import { toast } from 'sonner';
import VolumeControl from './VolumeControl';
import PlaybackRateControl from './PlaybackRateControl';
import { detectPlatform } from '@/lib/platform';
const isAndroidNative = () => detectPlatform() === 'android-app';

export default function PlayerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentSong, isPlaying, currentTime, duration, queue, queueIndex, playSong, togglePlay, next, previous, seek, setVolume, volume, closePlayer, isShuffled, toggleShuffle, repeatMode, cycleRepeat, playbackRate, isPlayerOpen, connectionStatus } = usePlayer();
  // Helper to map connection status to label and icon
  const statusInfo = {
    stable: {
      label: 'Connexion stable',
      icon: <Wifi className="h-4 w-4 text-green-500" />, 
    },
    slow: {
      label: 'Connexion lente',
      icon: <WifiOff className="h-4 w-4 text-yellow-500" />, 
    },
    unstable: {
      label: 'Connexion instable',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />, 
    },
  };
  const [showVolume, setShowVolume] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  useEffect(() => {
    if (!currentSong || !user) return;
    setOpening(true);
    const t = setTimeout(() => setOpening(false), 400);
    return () => clearTimeout(t);
  }, [currentSong?.id]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seek(percent * duration);
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      closePlayer();
    }, 350);
  };

  if (!currentSong || !isPlayerOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-background overflow-hidden ${
      closing ? 'animate-slide-out-down' : opening ? 'animate-slide-in-up' : ''
    }`}>
      {/* Blurred background cover */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl scale-110"
        style={{ backgroundImage: `url(${songCoverUrl(currentSong)})` }}
      />

      {/* Header — only one close button */}
      <div className="relative z-10 flex items-center justify-center px-4 pt-4 pb-2">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-muted-foreground backdrop-blur-xl transition-all duration-200 hover:bg-white/10 hover:text-foreground active:scale-90"
          aria-label="Fermer"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <p className="text-xs font-medium text-muted-foreground">En cours de lecture</p>
      </div>

      {/* Connection status indicator */}
      <div className="flex items-center justify-center space-x-1.5">
        {statusInfo[connectionStatus].icon}
        <span className="text-xs font-medium text-muted-foreground">
          {statusInfo[connectionStatus].label}
        </span>
      </div>

      {/* Cover art */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="group relative w-full max-w-sm">
          <div className="aspect-square w-full overflow-hidden rounded-[2rem] shadow-2xl shadow-primary/20 ring-1 ring-white/10 transition-all duration-500">
            <img
              src={songCoverUrl(currentSong)}
              alt={currentSong.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          {/* Glow effect behind cover */}
          <div
            className="absolute -inset-4 -z-10 rounded-[3rem] opacity-30 blur-2xl transition-opacity duration-500"
            style={{ backgroundImage: `url(${songCoverUrl(currentSong)})`, backgroundSize: 'cover' }}
          />
        </div>
      </div>

      {/* Song info */}
      <div className="relative z-10 px-6 pt-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground truncate">{currentSong.title}</h2>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{currentSong.author}</p>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-6 pt-5">
        <div
          ref={progressRef}
          className="relative h-2 w-full cursor-pointer rounded-full bg-white/10"
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full bg-gradient-primary transition-all duration-100 relative"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="relative z-10 flex items-center justify-center gap-4 px-6 py-3">
        <button
          onClick={toggleShuffle}
          className={`rounded-xl p-2.5 transition-all duration-200 ${
            isShuffled
              ? 'bg-primary/15 text-primary shadow-soft'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <Shuffle className="h-5 w-5" />
        </button>

        <button
          onClick={previous}
          className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
        >
          <SkipBack className="h-6 w-6" />
        </button>

        <button
          onClick={togglePlay}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant transition-all duration-200 hover:shadow-glow active:scale-95"
        >
          {isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play className="h-7 w-7 fill-current ml-0.5" />
          )}
        </button>

        <button
          onClick={next}
          className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
        >
          <SkipForward className="h-6 w-6" />
        </button>

        <button
          onClick={cycleRepeat}
          className={`relative rounded-xl p-2.5 transition-all duration-200 ${
            repeatMode !== 'off'
              ? 'bg-primary/15 text-primary shadow-soft'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          <Repeat className="h-5 w-5" />
          {repeatMode === 'one' && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
              1
            </span>
          )}
        </button>
      </div>

      {/* Action buttons (Cuts A-only: suppression likes/commentaires/playlist) */}
      <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-8 pt-2">
        {currentSong?.video_url && (
          <button
            onClick={() => navigate(`/video/${currentSong.id}`)}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 px-5 py-3 text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-white/10"
          >
            <Music2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Vidéo</span>
          </button>
        )}
      </div>
    </div>
  );
}