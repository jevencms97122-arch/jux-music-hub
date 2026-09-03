import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { songCoverUrl, avatarUrl, songAudioUrl } from '@/lib/storage';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import CachedImage from '@/components/CachedImage';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, ChevronDown, Music2, Wifi, WifiOff, AlertCircle, ListPlus, Gauge, Heart, MoreHorizontal, MessageSquare, ListMusic, Disc3, Repeat2, Share2, Download, Camera, Moon, Send, Link2, Users
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CommentsModal from '@/components/CommentsModal';
import { useNavigate } from 'react-router-dom';
import type { Song } from '@/types/music';
import { recordToSong } from '@/lib/pbUtils';
import { toast } from 'sonner';
import VolumeControl from './VolumeControl';
import SleepTimerSheet from './SleepTimerSheet';
import PlaybackRateControl from './PlaybackRateControl';
import AddToPlaylistModal from './AddToPlaylistModal';
import ShareToFriendSheet from './ShareToFriendSheet';
import { detectPlatform } from '@/lib/platform';
import { cn } from '@/lib/utils';
import ThemeBackgroundLayer from '@/components/ThemeBackgroundLayer';
import SessionParticipantsSheet from '@/components/SessionParticipantsSheet';

const isAndroidNative = () => detectPlatform() === 'android-app';

export default function PlayerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    currentSong, isPlaying, isBuffering, currentTime, duration, queue, queueIndex,
    playSong, togglePlay, next, previous, seek, setVolume, volume,
    closePlayer, isShuffled, toggleShuffle, repeatMode, cycleRepeat,
    playbackRate, isPlayerOpen, connectionStatus,
    sleepTimerMinutes, sleepTimerRemaining, activeSession, isSessionGuest,
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
  const [showQueue, setShowQueue] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarByGenre, setSimilarByGenre] = useState<Song[]>([]);
  const [similarByAuthor, setSimilarByAuthor] = useState<Song[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarTab, setSimilarTab] = useState<'genre' | 'author'>('genre');
  const [closing, setClosing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareChooser, setShowShareChooser] = useState(false);
  const [showShareToFriend, setShowShareToFriend] = useState(false);
  const [publisherProfile, setPublisherProfile] = useState<{ pseudo: string; avatar_url: string | null; user_id: string } | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  const shareSong = () => {
    if (!currentSong) return;
    setShowMenu(false);
    setShowShareChooser(true);
  };

  const copyShareLink = () => {
    if (!currentSong) return;
    setShowShareChooser(false);
    setShareUrl(`${window.location.origin}/song/${currentSong.id}`);
  };

  const copyShareUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié !', { description: 'Colle-le dans Discord, iMessage ou n\'importe où.' });
      setShareUrl(null);
    } catch {
      // HTTP context — select the input text so the user can Ctrl+C
      const input = document.getElementById('share-url-input') as HTMLInputElement | null;
      if (input) { input.select(); input.setSelectionRange(0, 99999); }
    }
  };
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState<string | null>(null);
  const [isReposted, setIsReposted] = useState(false);
  const [repostId, setRepostId] = useState<string | null>(null);
  const [reposters, setReposters] = useState<{ id: string; pseudo: string; avatar_url: string | null; user_id: string }[]>([]);
  const [showReposters, setShowReposters] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const toSong = recordToSong;

  const openSimilar = useCallback(async () => {
    if (!currentSong) return;
    setShowSimilar(true);
    setSimilarLoading(true);
    setSimilarTab('genre');
    setSimilarByGenre([]);
    setSimilarByAuthor([]);
    try {
      const [genreRes, authorRes] = await Promise.all([
        currentSong.genre
          ? pb.collection('songs').getList(1, 20, {
              filter: `genre = "${currentSong.genre}" && id != "${currentSong.id}"`,
              sort: '-play_count', requestKey: null,
            })
          : Promise.resolve({ items: [] }),
        currentSong.author
          ? pb.collection('songs').getList(1, 20, {
              filter: `author = "${currentSong.author}" && id != "${currentSong.id}"`,
              sort: '-play_count', requestKey: null,
            })
          : Promise.resolve({ items: [] }),
      ]);
      setSimilarByGenre((genreRes as any).items.map(toSong));
      setSimilarByAuthor((authorRes as any).items.map(toSong));
    } catch {}
    setSimilarLoading(false);
  }, [currentSong]);

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

  // Load publisher profile when song changes
  useEffect(() => {
    if (!currentSong?.uploaded_by) { setPublisherProfile(null); return; }
    pb.collection('profiles').getList(1, 1, {
      filter: `user_id = "${currentSong.uploaded_by}"`,
      requestKey: null,
    }).then((res) => {
      const p = (res as any).items[0];
      if (p) {
        setPublisherProfile({
          pseudo: p.pseudo || '?',
          user_id: p.user_id,
          avatar_url: p.avatar ? `${pb.baseUrl}/api/files/${p.collectionId}/${p.id}/${p.avatar}` : null,
        });
      } else {
        setPublisherProfile(null);
      }
    }).catch(() => setPublisherProfile(null));
  }, [currentSong?.id, currentSong?.uploaded_by]);

  // Load repost status + reposters (only followed users) when song changes
  useEffect(() => {
    if (!currentSong?.id) { setIsReposted(false); setRepostId(null); setReposters([]); return; }
    (async () => {
      try {
        // Fetch my repost status + all reposters + my following list in parallel
        const [myRepost, allReposts, followingRes] = await Promise.all([
          user
            ? pb.collection('repost').getList(1, 1, { filter: `user_id = "${user.id}" && song_id = "${currentSong.id}"`, requestKey: null })
            : Promise.resolve({ items: [] }),
          pb.collection('repost').getList(1, 50, { filter: `song_id = "${currentSong.id}"`, requestKey: null }),
          user
            ? pb.collection('follows').getList(1, 200, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null })
            : Promise.resolve({ items: [] }),
        ]);

        const myR = (myRepost as any).items;
        setIsReposted(myR.length > 0);
        setRepostId(myR.length > 0 ? myR[0].id : null);

        const allR = (allReposts as any).items as any[];
        if (allR.length === 0) { setReposters([]); return; }

        // Keep only reposters that the current user follows
        const followedIds = new Set((followingRes as any).items.map((f: any) => f.following_id) as string[]);
        const filteredR = allR.filter((r: any) => followedIds.has(r.user_id));
        if (filteredR.length === 0) { setReposters([]); return; }

        const userIds = [...new Set(filteredR.map((r: any) => r.user_id))] as string[];
        const filter = userIds.map((id) => `user_id = "${id}"`).join(' || ');
        const profiles = await pb.collection('profiles').getList(1, 50, { filter, requestKey: null });
        setReposters(profiles.items.map((p: any) => ({
          id: p.id, pseudo: p.pseudo || '?', user_id: p.user_id,
          avatar_url: p.avatar ? `${pb.baseUrl}/api/files/${p.collectionId}/${p.id}/${p.avatar}` : null,
        })));
      } catch { setIsReposted(false); setRepostId(null); setReposters([]); }
    })();
  }, [currentSong?.id, user]);

  const toggleRepost = async () => {
    if (!currentSong || !user) return;
    if (isReposted && repostId) {
      setIsReposted(false); setRepostId(null);
      setReposters((prev) => prev.filter((r) => r.user_id !== user.id));
      await pb.collection('repost').delete(repostId).catch(() => { setIsReposted(true); setRepostId(repostId); });
    } else {
      setIsReposted(true);
      const rec = await pb.collection('repost').create({ song_id: currentSong.id, user_id: user.id }).catch(() => { setIsReposted(false); return null; });
      if (rec) {
        setRepostId(rec.id);
        if (user) {
          const myProfile = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${user.id}"`, requestKey: null }).catch(() => ({ items: [] }));
          const p = (myProfile as any).items[0];
          if (p) setReposters((prev) => [...prev, { id: p.id, pseudo: p.pseudo || '?', user_id: p.user_id, avatar_url: p.avatar ? `${pb.baseUrl}/api/files/${p.collectionId}/${p.id}/${p.avatar}` : null }]);
        }
      }
    }
  };

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

  const coverUrl = songCoverUrl(currentSong);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-background overflow-hidden',
        closing ? 'animate-slide-out-down' : 'animate-slide-in-up'
      )}
    >
      {/* Backdrop — cover floutée ou fond du thème (animé/Ultra) sans cover. */}
      <div className="absolute -inset-[10%] will-change-transform">
        <AnimatePresence>
          {coverUrl ? (
            <motion.div
              key={currentSong.id + '-bg'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0 bg-cover bg-center blur-xl"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
          ) : (
            <motion.div
              key="theme-bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0 overflow-hidden"
            >
              <ThemeBackgroundLayer />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {coverUrl && <div className="absolute inset-0 bg-background/35" />}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={handleClose}
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground active:scale-90"
          aria-label="Fermer"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
        {activeSession ? (
          <button
            onClick={() => setShowParticipants(true)}
            className="glass flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-muted-foreground hover:text-foreground active:scale-90"
            aria-label="Voir les participants de la session"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold">{activeSession.participants?.length ?? 1}</span>
          </button>
        ) : (
          <p className="text-xs font-semibold tracking-wide text-muted-foreground/80">En écoute</p>
        )}
        <div className="glass flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
          {statusInfo[connectionStatus].icon}
          <span className="text-[10px] font-medium text-muted-foreground">
            {statusInfo[connectionStatus].label}
          </span>
        </div>
      </div>

      <SessionParticipantsSheet session={activeSession} open={showParticipants} onOpenChange={setShowParticipants} />

      {/* Cover art */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-8">
        <div className="relative w-full max-w-xs">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={currentSong.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="aspect-square w-full overflow-hidden rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/[0.08]"
            >
              <CachedImage
                src={coverUrl}
                alt={currentSong.title}
                className="h-full w-full object-cover"
              />
            </motion.div>
          </AnimatePresence>
          {/* Glow */}
          {coverUrl && (
            <div
              className="absolute -inset-6 -z-10 rounded-[3rem] opacity-25 blur-2xl"
              style={{ backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover' }}
            />
          )}
        </div>
      </div>

      {/* Glass controls panel */}
      <div className="glass-strong relative z-10 mx-4 mb-4 overflow-hidden rounded-3xl">
        {/* Song info + volume */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentSong.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
            <h2 className="truncate text-xl font-bold tracking-tight text-foreground">{currentSong.title}</h2>
            <div className="mt-0.5 flex items-center gap-2 min-w-0">
              <p className="truncate text-sm text-muted-foreground">{currentSong.author}</p>
              {publisherProfile && (
                <button
                  onClick={() => { setClosing(true); setTimeout(() => { setClosing(false); closePlayer(); navigate(`/u/${publisherProfile.user_id}`); }, 100); }}
                  className="flex items-center gap-1 flex-shrink-0"
                >
                  {publisherProfile.avatar_url ? (
                    <img
                      src={publisherProfile.avatar_url}
                      alt={publisherProfile.pseudo}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {publisherProfile.pseudo[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">{publisherProfile.pseudo}</span>
                </button>
              )}
            </div>
            </motion.div>
          </AnimatePresence>
          </div>
          <div className="ml-3 flex flex-shrink-0 items-center gap-1">
            <button
              onClick={toggleLike}
              className={cn(
                'rounded-xl p-2.5 transition-[background-color,color,transform] duration-150 active:scale-90',
                isLiked ? 'text-red-400 hover:text-red-300' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
              )}
              aria-label={isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={cn('h-5 w-5 transition-colors duration-150', isLiked && 'fill-current')} />
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
            className="group relative w-full cursor-pointer py-2.5"
            onClick={handleProgressClick}
          >
            {/* Piste visuelle : s'épaissit au survol via transform (pas de reflow) */}
            <div className="h-1.5 w-full origin-center rounded-full bg-white/[0.12] transition-transform duration-150 ease-out group-hover:scale-y-[1.7]">
              <div
                className="h-full rounded-full bg-gradient-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Curseur : sibling non affecté par le scaleY de la piste */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-foreground shadow-md opacity-0 transition-opacity duration-150 -translate-x-1/2 group-hover:opacity-100"
              style={{ left: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 px-6 py-4">
          <button
            onClick={toggleShuffle}
            className={cn(
              'rounded-xl p-2.5 transition-colors duration-150',
              isShuffled ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.07]'
            )}
          >
            <Shuffle className="h-5 w-5" />
          </button>

          <button
            onClick={previous}
            className="rounded-xl p-2.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-white/[0.07] active:scale-95"
          >
            <SkipBack className="h-6 w-6" />
          </button>

          <button
            onClick={togglePlay}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant transition-[box-shadow,transform] duration-150 hover:shadow-glow active:scale-95"
            aria-label={isBuffering ? 'Chargement' : isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering
              ? <div className="h-7 w-7 rounded-full border-[3px] border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              : isPlaying
                ? <Pause className="h-7 w-7 fill-current" />
                : <Play className="h-7 w-7 fill-current ml-0.5" />}
          </button>

          <button
            onClick={next}
            className="rounded-xl p-2.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-white/[0.07] active:scale-95"
          >
            <SkipForward className="h-6 w-6" />
          </button>

          <button
            onClick={cycleRepeat}
            className={cn(
              'relative rounded-xl p-2.5 transition-colors duration-150',
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

        {/* Reposters — compact pill */}
        {reposters.length > 0 && (
          <div className="px-6 pb-3">
            <button
              onClick={() => setShowReposters(true)}
              className="flex items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] transition-colors px-3 py-2 w-full"
            >
              <Repeat2 className="h-3.5 w-3.5 text-primary shrink-0" />
              {/* Stacked avatars (max 3) */}
              <div className="flex items-center shrink-0">
                {reposters.slice(0, 3).map((r, i) => (
                  <div
                    key={r.id}
                    className="h-5 w-5 rounded-full border border-background overflow-hidden bg-muted flex items-center justify-center text-[8px] font-bold"
                    style={{ marginLeft: i > 0 ? '-6px' : '0' }}
                  >
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                      : r.pseudo[0].toUpperCase()
                    }
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground flex-1 text-left">
                {reposters.length === 1
                  ? <><span className="text-foreground font-medium">{reposters[0].pseudo}</span> a republié</>
                  : <><span className="text-foreground font-medium">{reposters.length} personnes</span> ont republié</>
                }
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground -rotate-90 shrink-0" />
            </button>
          </div>
        )}
        {reposters.length === 0 && <div className="pb-2" />}
      </div>

      <VolumeControl open={showVolume} onClose={() => setShowVolume(false)} />
      <SleepTimerSheet open={showSleepTimer} onClose={() => setShowSleepTimer(false)} />
      <PlaybackRateControl open={showPlaybackRate} onClose={() => setShowPlaybackRate(false)} />
      <AddToPlaylistModal open={showAddToPlaylist} onOpenChange={setShowAddToPlaylist} songId={currentSong.id} />
      <CommentsModal open={showComments} onOpenChange={setShowComments} songId={currentSong.id} />

      {/* Choix du mode de partage */}
      <Sheet open={showShareChooser} onOpenChange={setShowShareChooser}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              Partager « {currentSong.title} »
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-2">
            <button
              onClick={() => { setShowShareChooser(false); setShowShareToFriend(true); }}
              className="flex w-full items-center gap-4 rounded-2xl border border-border/40 bg-card/50 px-4 py-4 hover:bg-card transition-colors text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Envoyer à un ami</p>
                <p className="text-xs text-muted-foreground">Choisis tes amis et personnalise l'extrait</p>
              </div>
            </button>
            <button
              onClick={copyShareLink}
              className="flex w-full items-center gap-4 rounded-2xl border border-border/40 bg-card/50 px-4 py-4 hover:bg-card transition-colors text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Link2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Copier le lien</p>
                <p className="text-xs text-muted-foreground">Partage le lien où tu veux</p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Envoyer à un ami */}
      <ShareToFriendSheet open={showShareToFriend} onOpenChange={setShowShareToFriend} song={currentSong} />

      {/* Dialog partage */}
      <Dialog open={!!shareUrl} onOpenChange={(open) => { if (!open) setShareUrl(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Partager la musique</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground text-center">
              Copie ce lien et colle-le où tu veux. Quand quelqu'un l'ouvre, la musique se lance automatiquement.
            </p>
            <div className="relative">
              <input
                id="share-url-input"
                readOnly
                value={shareUrl ?? ''}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm font-mono pr-24 focus:outline-none select-all cursor-text"
              />
            </div>
            <button
              onClick={() => shareUrl && copyShareUrl(shareUrl)}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold text-base active:scale-95 transition-transform"
            >
              Copier le lien
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Tu peux aussi appuyer sur le lien ci-dessus pour le sélectionner, puis faire Copier.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* File d'attente */}
      <Sheet open={showQueue} onOpenChange={setShowQueue}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[70vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>File d'attente</SheetTitle>
          </SheetHeader>
          {queue.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">La file d'attente est vide.</p>
          ) : (
            <div className="space-y-1">
              {queue.map((song, idx) => (
                <button
                  key={`${song.id}-${idx}`}
                  onClick={() => { playSong(song); setShowQueue(false); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors text-left',
                    idx === queueIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-white/[0.06]'
                  )}
                >
                  <div className="flex items-center justify-center w-6 shrink-0">
                    {idx === queueIndex ? (
                      <Music2 className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', idx === queueIndex && 'text-primary')}>{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.author}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Chansons similaires */}
      <Sheet open={showSimilar} onOpenChange={setShowSimilar}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[75vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Chansons similaires</SheetTitle>
          </SheetHeader>
          {/* Onglets */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSimilarTab('genre')}
              className={cn('flex-1 rounded-xl py-2 text-sm font-medium transition-colors', similarTab === 'genre' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              <span className="flex items-center justify-center gap-1.5"><Disc3 className="h-4 w-4" />Même genre</span>
            </button>
            <button
              onClick={() => setSimilarTab('author')}
              className={cn('flex-1 rounded-xl py-2 text-sm font-medium transition-colors', similarTab === 'author' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              <span className="flex items-center justify-center gap-1.5"><Music2 className="h-4 w-4" />Même artiste</span>
            </button>
          </div>

          {similarLoading && (
            <p className="text-center text-sm text-muted-foreground py-8">Chargement...</p>
          )}
          {!similarLoading && similarTab === 'genre' && (
            <>
              {!currentSong?.genre ? (
                <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                  <Disc3 className="h-10 w-10 opacity-25" />
                  <p className="text-sm">Indisponible — aucun genre associé à ce titre.</p>
                </div>
              ) : similarByGenre.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">Aucun autre titre pour le genre "{currentSong.genre}".</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-2">
                  {similarByGenre.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1 rounded-2xl bg-card p-2 cursor-pointer active:scale-95 transition-transform"
                      onClick={() => { playSong(s); setShowSimilar(false); }}>
                      <CachedImage src={songCoverUrl(s)} alt={s.title} className="w-full aspect-square rounded-xl object-cover" />
                      <p className="text-xs font-semibold truncate mt-1 px-1">{s.title}</p>
                      <p className="text-xs text-muted-foreground truncate px-1">{s.author}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {!similarLoading && similarTab === 'author' && (
            <>
              {similarByAuthor.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">Aucun autre titre de "{currentSong?.author}".</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-2">
                  {similarByAuthor.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1 rounded-2xl bg-card p-2 cursor-pointer active:scale-95 transition-transform"
                      onClick={() => { playSong(s); setShowSimilar(false); }}>
                      <CachedImage src={songCoverUrl(s)} alt={s.title} className="w-full aspect-square rounded-xl object-cover" />
                      <p className="text-xs font-semibold truncate mt-1 px-1">{s.title}</p>
                      <p className="text-xs text-muted-foreground truncate px-1">{s.author}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Qui a republié */}
      <Sheet open={showReposters} onOpenChange={setShowReposters}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[60vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-primary" />
              Republications
              <span className="ml-auto text-sm font-normal text-muted-foreground">{reposters.length}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {reposters.map((r) => (
              <button
                key={r.id}
                onClick={() => { setShowReposters(false); navigate(`/u/${r.user_id}`); }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/[0.06] transition-colors"
              >
                <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                  {r.avatar_url
                    ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    : r.pseudo[0].toUpperCase()
                  }
                </div>
                <span className="text-sm font-medium">{r.pseudo}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Menu 3 points */}
      <Sheet open={showMenu} onOpenChange={setShowMenu}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle className="truncate">{currentSong.title}</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            <button
              onClick={() => { setShowMenu(false); shareSong(); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <Share2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Partager</span>
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                const url = songAudioUrl(currentSong);
                if (!url) { toast.error('Fichier audio introuvable'); return; }
                const ext = url.split('?')[0].split('.').pop() || 'mp3';
                const filename = `${currentSong.title} - ${currentSong.author}.${ext}`;
                fetch(url)
                  .then(res => res.blob())
                  .then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch(() => toast.error('Échec du téléchargement'));
              }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <Download className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Télécharger</span>
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowQueue(true); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <ListMusic className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">File d'attente</span>
              {queue.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{queue.length} titre{queue.length > 1 ? 's' : ''}</span>
              )}
            </button>
            <button
              onClick={() => { setShowMenu(false); openSimilar(); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <Disc3 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Chansons similaires</span>
            </button>
            <button
              onClick={() => { setShowMenu(false); toggleRepost(); }}
              className={cn('flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors', isReposted ? 'text-green-400' : 'hover:bg-white/[0.06]')}
            >
              <Repeat2 className="h-5 w-5" />
              <span className="text-sm font-medium">{isReposted ? 'Republié ✓' : 'Republier'}</span>
              {reposters.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{reposters.length}</span>}
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowComments(true); }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Commentaires</span>
            </button>
            <button
              onClick={() => {
                // La composition se fait sur sa propre page : on referme le lecteur d'abord,
                // sinon il resterait affiché par-dessus.
                setShowMenu(false);
                setClosing(true);
                setTimeout(() => { setClosing(false); closePlayer(); navigate('/create-story'); }, 100);
              }}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 hover:bg-white/[0.06] transition-colors"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Créer une story</span>
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
            <button
              onClick={() => { setShowMenu(false); setShowSleepTimer(true); }}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors',
                sleepTimerMinutes !== null ? 'text-primary' : 'hover:bg-white/[0.06]'
              )}
            >
              <Moon className="h-5 w-5" />
              <span className="text-sm font-medium">Arrêt automatique</span>
              {sleepTimerRemaining !== null && (
                <span className="ml-auto text-xs font-bold text-primary">
                  {Math.floor(sleepTimerRemaining / 60)}m {(sleepTimerRemaining % 60).toString().padStart(2, '0')}s
                </span>
              )}
              {sleepTimerMinutes === -1 && sleepTimerRemaining === null && (
                <span className="ml-auto text-xs font-bold text-primary">Fin du morceau</span>
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
