import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '@/lib/pocketbase';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReactiveBg } from '@/hooks/useReactiveBg';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, ChevronDown, Music2, Wifi, WifiOff, AlertCircle, ListPlus, Gauge, Heart, MoreHorizontal, MessageSquare
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CommentsModal from '@/components/CommentsModal';
import { useNavigate } from 'react-router-dom';
import type { Song } from '@/types/music';
import { toast } from 'sonner';
import VolumeControl from './VolumeControl';
import PlaybackRateControl from './PlaybackRateControl';
import AddToPlaylistModal from './AddToPlaylistModal';
import { detectPlatform } from '@/lib/platform';
import { cn } from '@/lib/utils';

const isAndroidNative = () => detectPlatform() === 'android-app';

export default function PlayerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    currentSong, isPlaying, currentTime, duration, queue, queueIndex,
    playSong, togglePlay, next, previous, seek, setVolume, volume,
    closePlayer, isShuffled, toggleShuffle, repeatMode, cycleRepeat,
    playbackRate, isPlayerOpen, connectionStatus, getAnalyserNode,
  } = usePlayer();

  const statusInfo = {
    stable: { label: 'Stable', icon: <Wifi className="h-3.5 w-3.5 text-green-400" /> },
    slow: { label: 'Lente', icon: <WifiOff className="h-3.5 w-3.5 text-amber-400" /> },
    unstable: { label: 'Instable', icon: <AlertCircle className="h-3.5 w-3.5 text-red-400" /> },
  };

  const [showVolume, setShowVolume] = useState(false);
  const [showPlaybackRate, setShowPlaybackRate] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [songChangeAnim, setSongChangeAnim] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState<string | null>(null);
  const prevSongIdRef = useRef<string | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const { enabled: reactiveBg } = useReactiveBg();

  // Opening animation fires ONLY when the player transitions from closed → open
  useEffect(() => {
    if (!isPlayerOpen) return;
    setOpening(true);
    const t = setTimeout(() => setOpening(false), 400);
    return () => clearTimeout(t);
  }, [isPlayerOpen]);

  // Load like status when song changes
  useEffect(() => {
    if (!currentSong?.id || !user) { setIsLiked(false); setLikeId(null); return; }
    pb.collection('song_likes').getList(1, 1, {
      filter: `user_id = "${user.id}" && song_id = "${currentSong.id}"`,
      requestKey: null,
    }).then((res) => {
      if (res.items.length > 0) { setIsLiked(true); setLikeId(res.items[0].id); }
      else { setIsLiked(false); setLikeId(null); }
    }).catch(() => { setIsLiked(false); setLikeId(null); });
  }, [currentSong?.id, user]);

  const toggleLike = async () => {
    if (!currentSong || !user) return;
    if (isLiked && likeId) {
      setIsLiked(false); setLikeId(null);
      await pb.collection('song_likes').delete(likeId).catch(() => { setIsLiked(true); setLikeId(likeId); });
    } else {
      setIsLiked(true);
      const rec = await pb.collection('song_likes').create({ song_id: currentSong.id, user_id: user.id }).catch(() => { setIsLiked(false); return null; });
      if (rec) setLikeId(rec.id);
    }
  };

  // Song change animation fires ONLY when song changes while the player is already open
  useEffect(() => {
    if (!currentSong?.id) return;
    const prev = prevSongIdRef.current;
    prevSongIdRef.current = currentSong.id;
    if (prev && prev !== currentSong.id && isPlayerOpen) {
      setSongChangeAnim(true);
      const t = setTimeout(() => setSongChangeAnim(false), 520);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  // Reactive background — frequency-driven animation via Web Audio API analyser
  useEffect(() => {
    if (!reactiveBg || !isPlaying) {
      cancelAnimationFrame(rafRef.current);
      // Reset inline transform so the CSS class scale-110 takes over
      if (bgRef.current) bgRef.current.style.transform = '';
      return;
    }

    const analyser = getAnalyserNode();
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    let startTime: number | null = null;
    // Lerped values for smooth transitions
    let smoothScale = 1.1; // matches scale-110 base
    let smoothX = 0;
    let smoothY = 0;

    const animate = (now: number) => {
      if (!startTime) startTime = now;
      const t = (now - startTime) / 1000;

      let bassEnergy = 0;

      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        // Sub-bass only: bins 0-2 (~0-172 Hz)
        for (let i = 0; i < 3; i++) bassEnergy += dataArray[i];
        bassEnergy = bassEnergy / 3 / 255;
        // Threshold + cubic curve: ignore below 65%, cubic exponent for very selective response
        const threshold = 0.88;
        bassEnergy = Math.pow(Math.max(0, bassEnergy - threshold) / (1 - threshold), 3);
      }

      const targetScale = 1.1 + bassEnergy * 0.52;
      const targetX = Math.sin(t * 0.28) * 5 + Math.sin(t * 0.13) * 3;
      const targetY = Math.cos(t * 0.21) * 5 + Math.cos(t * 0.09) * 3;

      const lerpRate = targetScale > smoothScale ? 0.14 : 0.03;
      smoothScale += (targetScale - smoothScale) * lerpRate;
      smoothX += (targetX - smoothX) * 0.04;
      smoothY += (targetY - smoothY) * 0.04;

      if (bgRef.current) {
        bgRef.current.style.transform = `translate(${smoothX}%, ${smoothY}%) scale(${smoothScale})`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reactiveBg, isPlaying, getAnalyserNode]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); closePlayer(); }, 350);
  };

  if (!currentSong || !isPlayerOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background overflow-hidden',
        closing ? 'animate-slide-out-down' : opening ? 'animate-slide-in-up' : ''
      )}
    >
      {/* Blurred background — key force le remount à chaque chanson, l'animation cible opacity 0.25 directement */}
      <div
        ref={bgRef}
        key={currentSong.id + '-bg'}
        className="absolute inset-0 bg-cover bg-center blur-xl animate-bg-cover-in scale-110"
        style={{ backgroundImage: `url(${songCoverUrl(currentSong)})` }}
      />
      <div className="absolute inset-0 bg-background/35" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={handleClose}
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground active:scale-90"
          aria-label="Fermer"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground/80">En écoute</p>
        <div className="glass flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
          {statusInfo[connectionStatus].icon}
          <span className="text-[10px] font-medium text-muted-foreground">
            {statusInfo[connectionStatus].label}
          </span>
        </div>
      </div>

      {/* Cover art */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-8">
        <div className="relative w-full max-w-xs">
          <div
            key={currentSong.id}
            className={cn(
              'aspect-square w-full overflow-hidden rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/[0.08]',
              songChangeAnim && 'animate-scale-in'
            )}
          >
            <img
              src={songCoverUrl(currentSong)}
              alt={currentSong.title}
              className="h-full w-full object-cover"
            />
          </div>
          {/* Glow */}
          <div
            className="absolute -inset-6 -z-10 rounded-[3rem] opacity-25 blur-2xl"
            style={{ backgroundImage: `url(${songCoverUrl(currentSong)})`, backgroundSize: 'cover' }}
          />
        </div>
      </div>

      {/* Glass controls panel */}
      <div className="glass-strong relative z-10 mx-4 mb-4 overflow-hidden rounded-3xl">
        {/* Song info + volume */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div
            key={currentSong.id}
            className={cn('min-w-0 flex-1', songChangeAnim && 'animate-slide-up-stagger')}
          >
            <h2 className="truncate text-xl font-bold tracking-tight text-foreground">{currentSong.title}</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{currentSong.author}</p>
          </div>
          <div className="ml-3 flex flex-shrink-0 items-center gap-1">
            <button
              onClick={toggleLike}
              className={cn(
                'rounded-xl p-2.5 transition-all duration-150 active:scale-90',
                isLiked ? 'text-red-400 hover:text-red-300' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
              )}
              aria-label={isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={cn('h-5 w-5 transition-all duration-150', isLiked && 'fill-current')} />
            </button>
            <button
              onClick={() => setShowVolume(true)}
              className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.07] active:scale-95"
              aria-label="Volume"
            >
              <Volume2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowMenu(true)}
              className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.07] active:scale-95"
              aria-label="Plus d'options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 pt-5">
          <div
            ref={progressRef}
            className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/[0.12] hover:h-2.5 transition-all duration-150"
            onClick={handleProgressClick}
          >
            <div
              className="h-full rounded-full bg-gradient-primary"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 -translate-x-1/2"
              style={{ left: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 px-6 py-4">
          <button
            onClick={toggleShuffle}
            className={cn(
              'rounded-xl p-2.5 transition-all duration-150',
              isShuffled ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
            )}
          >
            <Shuffle className="h-5 w-5" />
          </button>

          <button
            onClick={previous}
            className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.07] active:scale-95"
          >
            <SkipBack className="h-6 w-6" />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant hover:shadow-glow active:scale-95 transition-all duration-150"
          >
            {isPlaying
              ? <Pause className="h-7 w-7 fill-current" />
              : <Play className="h-7 w-7 fill-current ml-0.5" />}
          </button>

          <button
            onClick={next}
            className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.07] active:scale-95"
          >
            <SkipForward className="h-6 w-6" />
          </button>

          <button
            onClick={cycleRepeat}
            className={cn(
              'relative rounded-xl p-2.5 transition-all duration-150',
              repeatMode !== 'off' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
            )}
          >
            <Repeat className="h-5 w-5" />
            {repeatMode === 'one' && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                1
              </span>
            )}
          </button>
        </div>

        <div className="pb-2" />
      </div>

      <VolumeControl open={showVolume} onClose={() => setShowVolume(false)} />
      <PlaybackRateControl open={showPlaybackRate} onClose={() => setShowPlaybackRate(false)} />
      <AddToPlaylistModal open={showAddToPlaylist} onOpenChange={setShowAddToPlaylist} songId={currentSong.id} />
      <CommentsModal open={showComments} onOpenChange={setShowComments} songId={currentSong.id} />

      {/* Menu 3 points */}
      <Sheet open={showMenu} onOpenChange={setShowMenu}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle className="truncate">{currentSong.title}</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            <button
              onClick={() => { setShowMenu(false); setShowComments(true); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Commentaires</span>
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowAddToPlaylist(true); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <ListPlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Ajouter à une playlist</span>
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowPlaybackRate(true); }}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors',
                playbackRate !== 1 && 'text-primary'
              )}
            >
              <Gauge className="h-5 w-5" />
              <span className="text-sm font-medium">Vitesse de lecture</span>
              {playbackRate !== 1 && (
                <span className="ml-auto text-xs font-bold text-primary">{Math.round(playbackRate * 100)}%</span>
              )}
            </button>
            {currentSong.video_url && (
              <button
                onClick={() => { setShowMenu(false); navigate(`/video/${currentSong.id}`); }}
                className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
              >
                <Music2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Voir la vidéo</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
