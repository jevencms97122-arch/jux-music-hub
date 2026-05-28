import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, MoreHorizontal, Heart, ListPlus, Sparkles, Headphones, Radio, MessageCircle, Download, Trash2, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import CommentsModal from './CommentsModal';
import DownloadAppModal from './DownloadAppModal';
import VolumeControl from '@/components/VolumeControl';
import PlaybackRateControl from '@/components/PlaybackRateControl';
import SynchronizedVideoPlayer from './SynchronizedVideoPlayer';
import { detectPlatform, requestNativeDownload, isSongDownloaded, deleteDownloadedSong, onDownloadProgress, type DownloadStatus } from '@/lib/platform';
import { songAudioUrl } from '@/lib/storage';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState, useRef } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Minus, Plus } from 'lucide-react';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreateStoryModal from './CreateStoryModal';
import { toast } from 'sonner';

function formatTime(s: number) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerPage() {
  const { authUser } = useAuth();
  const {
    currentSong, isPlaying, currentTime, duration, isPlayerOpen,
    closePlayer, togglePlay, next, previous, seek,
    isShuffled, toggleShuffle, repeatMode, cycleRepeat,
    playbackRate, setPlaybackRate, refreshSongStats,
    crossfadeSeconds, setCrossfadeSeconds, startRadio,
    signalVideoReady,
  } = usePlayer();
  const [seeking, setSeeking] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDownloadApp, setShowDownloadApp] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [playbackRateOpen, setPlaybackRateOpen] = useState(false);

  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Détection mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Vérifie si le morceau est déjà téléchargé hors connexion
  useEffect(() => {
    if (!currentSong) { setIsDownloaded(false); setDownloadStatus('idle'); setDownloadProgress(0); return; }
    let cancelled = false;
    isSongDownloaded(currentSong.id).then((d) => {
      if (cancelled) return;
      setIsDownloaded(d);
      setDownloadStatus(d ? 'done' : 'idle');
      setDownloadProgress(d ? 100 : 0);
    });
    return () => { cancelled = true; };
  }, [currentSong]);

  // Écoute les événements de progression du bridge natif
  useEffect(() => {
    const off = onDownloadProgress((e) => {
      if (!currentSong || e.songId !== currentSong.id) return;
      setDownloadStatus(e.status);
      setDownloadProgress(Math.max(0, Math.min(100, Math.round(e.progress))));
      if (e.status === 'error') setDownloadError(e.error ?? 'Erreur de téléchargement');
      if (e.status === 'done') { setIsDownloaded(true); setDownloadError(null); }
    });
    return off;
  }, [currentSong]);

  const handleDownload = () => {
    if (!currentSong) return;
    const platform = detectPlatform();
    if (platform === 'web') {
      setShowDownloadApp(true);
      return;
    }
    setDownloadError(null);
    setDownloadStatus('downloading');
    setDownloadProgress(0);
    const ok = requestNativeDownload({
      id: currentSong.id,
      title: currentSong.title,
      author: currentSong.author,
      audioUrl: songAudioUrl(currentSong),
      coverUrl: songCoverUrl(currentSong),
    });
    if (ok) {
      toast.success('Téléchargement lancé', { description: currentSong.title, position: 'bottom-center' });
    } else {
      setDownloadStatus('idle');
      setShowDownloadApp(true);
    }
  };

  const handleDeleteDownload = async () => {
    if (!currentSong) return;
    const ok = await deleteDownloadedSong(currentSong.id);
    if (ok) {
      setIsDownloaded(false);
      setDownloadStatus('idle');
      setDownloadProgress(0);
      toast('Titre supprimé du hors connexion', { description: currentSong.title, position: 'bottom-center' });
    } else {
      toast.error('Impossible de supprimer ce titre');
    }
  };
  const [uploaderProfile, setUploaderProfile] = useState<{ pseudo: string | null; avatar_url: string | null } | null>(null);
  const [showLikeAnim, setShowLikeAnim] = useState(false);
  const [friendLikers, setFriendLikers] = useState<Array<{ user_id: string; pseudo: string | null; avatar_url: string | null }>>([]);
  const lastTap = useRef<number>(0);

  // Récupère le profil de l'uploader de la musique
  useEffect(() => {
    if (!currentSong) { setUploaderProfile(null); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('pseudo, avatar_url')
        .eq('user_id', currentSong.uploaded_by)
        .maybeSingle();
      setUploaderProfile(data as { pseudo: string | null; avatar_url: string | null } | null);
    })();
  }, [currentSong]);

  useEffect(() => {
    if (!currentSong) { setCommentsCount(0); return; }
    supabase
      .from('song_comments').select('id', { count: 'exact', head: true })
      .eq('song_id', currentSong.id)
      .then(({ count }) => setCommentsCount(count ?? 0));
  }, [currentSong]);

  useEffect(() => {
    if (!authUser || !currentSong) { setLiked(false); return; }
    supabase
      .from('song_likes').select('id')
      .eq('song_id', currentSong.id).eq('user_id', authUser.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [authUser, currentSong]);

  // Récupère les amis (suivis acceptés) qui ont liké ce titre
  useEffect(() => {
    if (!authUser || !currentSong) { setFriendLikers([]); return; }
    (async () => {
      const { data: follows } = await supabase
        .from('follows').select('following_id')
        .eq('follower_id', authUser.id).eq('status', 'accepted');
      const ids = (follows ?? []).map((f: any) => f.following_id);
      if (ids.length === 0) { setFriendLikers([]); return; }
      const { data: likes } = await supabase
        .from('song_likes').select('user_id')
        .eq('song_id', currentSong.id).in('user_id', ids);
      const likerIds = (likes ?? []).map((l: any) => l.user_id);
      if (likerIds.length === 0) { setFriendLikers([]); return; }
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, pseudo, avatar_url').in('user_id', likerIds);
      setFriendLikers((profiles ?? []) as any);
    })();
  }, [authUser, currentSong]);

  const toggleLike = async () => {
    if (!authUser || !currentSong) return false;
    if (liked) {
      const { error } = await supabase.from('song_likes').delete()
        .eq('song_id', currentSong.id).eq('user_id', authUser.id);
      if (error) { toast.error("Impossible de retirer le j'aime"); return false; }
      setLiked(false);
      await refreshSongStats(currentSong.id);
      toast('Like retiré', { description: currentSong.title, position: 'bottom-center' });
      return false;
    } else {
      const { error } = await supabase.from('song_likes').insert({ song_id: currentSong.id, user_id: authUser.id });
      if (error) { toast.error("Impossible d'ajouter le j'aime"); return false; }
      setLiked(true);
      await refreshSongStats(currentSong.id);
      toast.success('Ajouté aux titres likés', { description: currentSong.title, position: 'bottom-center' });
      return true;
    }
  };

  if (!isPlayerOpen || !currentSong) return null;

  const value = seeking ?? currentTime;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background animate-in slide-in-from-bottom">
        {/* ── Video background fullscreen ── */}
        {currentSong.video_url ? (
          <SynchronizedVideoPlayer
            song={currentSong}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onReady={signalVideoReady}
            asBackground
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
        )}

        {/* ── Mobile layout ── */}
        <div className={`relative z-20 flex flex-1 flex-col ${isMobile ? 'px-3 pt-1.5 pb-2' : 'p-6 pb-2'} h-full`}>
          {/* Header */}
          <div className={`flex items-center justify-between ${isMobile ? 'mb-0.5' : 'mb-2'}`}>
            <button onClick={closePlayer} aria-label="Fermer" className="rounded-full p-1 hover:bg-secondary">
              <ChevronDown className={isMobile ? 'h-4 w-4' : 'h-6 w-6'} />
            </button>
            <span className={`font-medium uppercase tracking-wider text-muted-foreground ${isMobile ? 'text-[9px]' : 'text-xs'}`}>En cours</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-1 text-[10px] font-medium backdrop-blur hover:bg-secondary">
                <MoreHorizontal className="h-3.5 w-3.5" /> Options
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setVolumeOpen(true)}>
                  <Volume2 className="mr-2 h-4 w-4" /> Volume
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPlaybackRateOpen(true)}>
                  Musique à {Math.round(playbackRate * 100)}%
                </DropdownMenuItem>
                <div className="my-1 border-t border-border" />
                <DropdownMenuItem onClick={() => setShowPlaylist(true)}>Ajouter à la playlist</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowStory(true)}>Ajouter à la story</DropdownMenuItem>
                {isDownloaded ? (
                  <DropdownMenuItem onClick={handleDeleteDownload} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer le titre hors connexion
                  </DropdownMenuItem>
                ) : downloadStatus === 'downloading' ? (
                  <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()} className="flex flex-col items-stretch gap-1">
                    <div className="flex items-center text-sm">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Téléchargement… {downloadProgress}%
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${downloadProgress}%` }} />
                    </div>
                  </DropdownMenuItem>
                ) : downloadStatus === 'error' ? (
                  <DropdownMenuItem onClick={handleDownload} className="text-destructive focus:text-destructive">
                    <AlertCircle className="mr-2 h-4 w-4" /> Échec — réessayer
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" /> Télécharger (hors connexion)
                  </DropdownMenuItem>
                )}
<DropdownMenuItem onClick={() => currentSong && startRadio(currentSong)}>
                  <Radio className="mr-2 h-4 w-4" /> Démarrer la radio
                </DropdownMenuItem>
                <div className="px-3 py-2">
                  <DropdownMenuItem className="flex items-center justify-between p-2 cursor-default">
                    <span className="text-sm">Fondu enchaîné</span>
                    <Switch 
                      checked={crossfadeSeconds > 0} 
                      onCheckedChange={(checked) => checked ? setCrossfadeSeconds(3) : setCrossfadeSeconds(0)}
                    />
                  </DropdownMenuItem>
                  {crossfadeSeconds > 0 && (
                    <div className="pl-6 pb-2">
                      <span className="text-xs text-muted-foreground block mb-1">Durée du fondu</span>
                      <Slider 
                        value={[crossfadeSeconds]} 
                        min={1}
                        max={12}
                        step={0.5}
                        onValueChange={(v) => setCrossfadeSeconds(v[0])}
                        className="w-32"
                      />
                      <span className="text-xs text-muted-foreground mt-1">{crossfadeSeconds.toFixed(1)} s</span>
                    </div>
                  )}
                </div>
<div className="my-1 border-t border-border" />

              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Cover image */}
          <div className={`flex items-center justify-center ${isMobile ? 'flex-[0.9] py-0.5' : 'flex-1 py-4 sm:py-8'}`}>
            <div className={`relative flex w-full items-center justify-center ${isMobile ? 'px-0 max-w-[50vw]' : 'px-4 sm:max-w-sm'}`}>
              {currentSong.video_url ? (
                <div className="relative w-full overflow-hidden rounded-2xl shadow-elegant" style={{ aspectRatio: '1 / 1' }}>
                  <img
                    src={songCoverUrl(currentSong)}
                    alt={currentSong.title}
                    className="h-full w-full rounded-2xl object-cover shadow-elegant"
                    onDoubleClick={async () => {
                      const isNowLiked = await toggleLike();
                      if (isNowLiked) {
                        setShowLikeAnim(true);
                        setTimeout(() => setShowLikeAnim(false), 800);
                      }
                    }}
                    onTouchStart={() => {
                      const now = Date.now();
                      if (now - lastTap.current < 300) {
                        toggleLike().then((isNowLiked) => {
                          if (isNowLiked) {
                            setShowLikeAnim(true);
                            setTimeout(() => setShowLikeAnim(false), 800);
                          }
                        });
                        lastTap.current = 0;
                      } else lastTap.current = now;
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart className={`h-24 w-24 transition-all duration-300 ${showLikeAnim ? 'scale-100 opacity-100 text-primary' : 'scale-0 opacity-0 text-white'}`} />
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={songCoverUrl(currentSong)}
                    alt={currentSong.title}
                    className="w-full rounded-2xl object-contain shadow-elegant sm:aspect-square sm:object-cover"
                    style={isMobile ? { maxHeight: '40vh' } : {}}
                    onDoubleClick={async () => {
                      const isNowLiked = await toggleLike();
                      if (isNowLiked) {
                        setShowLikeAnim(true);
                        setTimeout(() => setShowLikeAnim(false), 800);
                      }
                    }}
                    onTouchStart={() => {
                      const now = Date.now();
                      if (now - lastTap.current < 300) {
                        toggleLike().then((isNowLiked) => {
                          if (isNowLiked) {
                            setShowLikeAnim(true);
                            setTimeout(() => setShowLikeAnim(false), 800);
                          }
                        });
                        lastTap.current = 0;
                      } else lastTap.current = now;
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart className={`h-24 w-24 transition-all duration-300 ${showLikeAnim ? 'scale-100 opacity-100 text-primary' : 'scale-0 opacity-0 text-white'}`} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Song info + stats */}
          <div className={isMobile ? 'mb-0.5' : 'mb-3'}>
            <h2 className={`truncate font-bold text-foreground ${isMobile ? 'text-sm leading-tight' : 'text-2xl'}`}>{currentSong.title}</h2>
            <p className={`truncate text-muted-foreground ${isMobile ? 'text-[11px]' : 'text-sm'}`}>{currentSong.author}</p>
            <div className={`flex flex-wrap items-center gap-1 text-muted-foreground ${isMobile ? 'mt-0.5' : 'mt-1'}`}>
              <span className={`flex items-center gap-1 ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                <Headphones className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'}`} /> {(currentSong.play_count ?? 0).toLocaleString()}
              </span>
              <button
                onClick={toggleLike}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-secondary ${liked ? 'text-red-500 hover:text-red-500' : ''} ${isMobile ? 'text-[9px]' : 'text-xs'}`}
                aria-label={liked ? 'Retirer le like' : 'Ajouter un like'}
              >
                <Heart className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'} ${liked ? 'fill-current' : ''}`} /> {(currentSong.likes_count ?? 0).toLocaleString()}
              </button>
              <button
                onClick={() => setShowComments(true)}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-secondary hover:text-foreground ${isMobile ? 'text-[9px]' : 'text-xs'}`}
                aria-label="Commentaires"
              >
                <MessageCircle className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'}`} /> {commentsCount.toLocaleString()}
              </button>
              {uploaderProfile && (
                <div className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                  <Avatar className={`border border-background ${isMobile ? 'h-3.5 w-3.5' : 'h-5 w-5'}`}>
                    <AvatarImage src={avatarUrl({ avatar_url: uploaderProfile.avatar_url })} />
                    <AvatarFallback className="text-[6px]">{(uploaderProfile.pseudo ?? '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-muted-foreground">{uploaderProfile.pseudo ?? 'Anonyme'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Friend likers */}
          {friendLikers.length > 0 && (
            <div className={`flex items-center gap-2 rounded-full bg-secondary/40 px-2 py-1 backdrop-blur ${isMobile ? 'mb-0.5' : 'mb-2'}`}>
              <div className="flex -space-x-1.5">
                {friendLikers.slice(0, 3).map((f) => (
                  <Avatar key={f.user_id} className={`border-2 border-background ${isMobile ? 'h-4 w-4' : 'h-6 w-6'}`}>
                    <AvatarImage src={avatarUrl({ avatar_url: f.avatar_url })} />
                    <AvatarFallback className="text-[7px]">{(f.pseudo ?? '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className={`truncate text-muted-foreground ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                {friendLikers.length === 1
                  ? <><span className="font-medium text-foreground">{friendLikers[0].pseudo ?? 'Un ami'}</span> a aimé ce titre</>
                  : <><span className="font-medium text-foreground">{friendLikers[0].pseudo ?? 'Un ami'}</span> et {friendLikers.length - 1} autre{friendLikers.length - 1 > 1 ? 's' : ''} ont aimé ce titre</>}
              </span>
            </div>
          )}

          {/* Seek bar */}
          <div className={isMobile ? 'mb-0.5' : 'mb-2'}>
            <Slider
              value={[value]}
              max={duration || 1}
              step={0.1}
              onValueChange={(v) => setSeeking(v[0])}
              onValueCommit={(v) => { seek(v[0]); setSeeking(null); }}
            />
            <div className={`mt-0.5 flex justify-between ${isMobile ? 'text-[9px]' : 'text-xs'} text-muted-foreground`}>
              <span>{formatTime(value)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className={`flex items-center justify-around ${isMobile ? 'py-1.5' : 'py-4'}`}>
            <ShuffleButton isShuffled={isShuffled} toggleShuffle={toggleShuffle} isMobile={isMobile} />
            <button onClick={previous} aria-label="Précédent" className="rounded-full p-1.5 hover:bg-secondary">
              <SkipBack className={`fill-current ${isMobile ? 'h-5 w-5' : 'h-7 w-7'}`} />
            </button>
            <button
              onClick={togglePlay}
              className={`flex items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 active:scale-95 ${
                isMobile ? 'h-12 w-12' : 'h-16 w-16'
              }`}
            >
              {isPlaying ? <Pause className={`fill-current ${isMobile ? 'h-5 w-5' : 'h-7 w-7'}`} /> : <Play className={`fill-current ${isMobile ? 'h-5 w-5' : 'h-7 w-7'}`} />}
            </button>
            <button onClick={next} aria-label="Suivant" className="rounded-full p-1.5 hover:bg-secondary">
              <SkipForward className={`fill-current ${isMobile ? 'h-5 w-5' : 'h-7 w-7'}`} />
            </button>
            <RepeatButton repeatMode={repeatMode} cycleRepeat={cycleRepeat} isMobile={isMobile} />
          </div>
        </div>
      </div>
      <AddToPlaylistModal open={showPlaylist} onOpenChange={setShowPlaylist} songId={currentSong.id} />
      <CreateStoryModal open={showStory} onOpenChange={setShowStory} />
      <CommentsModal open={showComments} onOpenChange={setShowComments} songId={currentSong.id} onCountChange={setCommentsCount} />
      <DownloadAppModal open={showDownloadApp} onOpenChange={setShowDownloadApp} />
      <VolumeControl open={volumeOpen} onClose={() => setVolumeOpen(false)} />
      <PlaybackRateControl open={playbackRateOpen} onClose={() => setPlaybackRateOpen(false)} />
    </>
  );
}

function ShuffleButton({ isShuffled, toggleShuffle, isMobile }: { isShuffled: boolean; toggleShuffle: () => void; isMobile: boolean }) {
  return (
    <button onClick={toggleShuffle} className={`rounded-full p-2 transition-colors ${isShuffled ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
      <Shuffle className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
    </button>
  );
}

function RepeatButton({ repeatMode, cycleRepeat, isMobile }: { repeatMode: 'off' | 'all' | 'one'; cycleRepeat: () => void; isMobile: boolean }) {
  return (
    <button onClick={cycleRepeat} className={`rounded-full p-2 transition-colors ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
      {repeatMode === 'one' ? <Repeat1 className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} /> : <Repeat className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />}
    </button>
  );
}