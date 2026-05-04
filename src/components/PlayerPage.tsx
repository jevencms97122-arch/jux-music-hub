import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, MoreHorizontal, Heart, ListPlus, Sparkles, Headphones, Radio } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  } = usePlayer();
  const [seeking, setSeeking] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showLikeAnim, setShowLikeAnim] = useState(false);
  const [friendLikers, setFriendLikers] = useState<Array<{ user_id: string; pseudo: string | null; avatar_url: string | null }>>([]);
  const lastTap = useRef<number>(0);

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
        <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
        <div className="relative flex flex-1 flex-col p-6">
          <div className="flex items-center justify-between">
            <button onClick={closePlayer} aria-label="Fermer" className="rounded-full p-2 hover:bg-secondary">
              <ChevronDown className="h-6 w-6" />
            </button>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En cours</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-secondary">
                <MoreHorizontal className="h-4 w-4" /> Options
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setShowPlaylist(true)}>Ajouter à la playlist</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowStory(true)}>Ajouter à la story</DropdownMenuItem>
                <DropdownMenuItem onClick={() => currentSong && startRadio(currentSong)}>
                  <Radio className="mr-2 h-4 w-4" /> Démarrer une radio
                </DropdownMenuItem>
                <div className="my-1 border-t border-border" />
                <div className="px-2 py-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Crossfade</span>
                    <span className="font-medium">{crossfadeSeconds}s</span>
                  </div>
                  <input
                    type="range" min={0} max={12} step={1}
                    value={crossfadeSeconds}
                    onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-1 items-center justify-center py-8">
            <div className="relative w-full max-w-sm">
              <img
                src={songCoverUrl(currentSong)}
                alt={currentSong.title}
                className="aspect-square w-full rounded-2xl object-cover shadow-elegant"
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
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold text-foreground">{currentSong.title}</h2>
              <p className="truncate text-sm text-muted-foreground">{currentSong.author}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Headphones className="h-3 w-3" /> {(currentSong.play_count ?? 0).toLocaleString()}</span>
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {(currentSong.likes_count ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {friendLikers.length > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-full bg-secondary/40 px-3 py-1.5 backdrop-blur">
              <div className="flex -space-x-2">
                {friendLikers.slice(0, 3).map((f) => (
                  <Avatar key={f.user_id} className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={avatarUrl({ avatar_url: f.avatar_url })} />
                    <AvatarFallback className="text-[10px]">{(f.pseudo ?? '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {friendLikers.length === 1
                  ? <><span className="font-medium text-foreground">{friendLikers[0].pseudo ?? 'Un ami'}</span> a aimé ce titre</>
                  : <><span className="font-medium text-foreground">{friendLikers[0].pseudo ?? 'Un ami'}</span> et {friendLikers.length - 1} autre{friendLikers.length - 1 > 1 ? 's' : ''} ont aimé ce titre</>}
              </span>
            </div>
          )}

          <div className="mb-3 flex items-center justify-center gap-3 rounded-full bg-secondary/40 px-4 py-2 backdrop-blur">
            <button
              onClick={() => setPlaybackRate(Math.max(0.5, Math.round((playbackRate - 0.01) * 100) / 100))}
              aria-label="Diminuer la vitesse"
              className="rounded-full p-1.5 hover:bg-secondary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[110px] text-center text-sm font-medium">
              Musique à {Math.round(playbackRate * 100)}%
            </span>
            <button
              onClick={() => setPlaybackRate(Math.min(2, Math.round((playbackRate + 0.01) * 100) / 100))}
              aria-label="Augmenter la vitesse"
              className="rounded-full p-1.5 hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-2">
            <Slider
              value={[value]}
              max={duration || 1}
              step={0.1}
              onValueChange={(v) => setSeeking(v[0])}
              onValueCommit={(v) => { seek(v[0]); setSeeking(null); }}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(value)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-around py-4">
            <button onClick={toggleShuffle} className={`rounded-full p-2 transition-colors ${isShuffled ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Shuffle className="h-5 w-5" />
            </button>
            <button onClick={previous} aria-label="Précédent" className="rounded-full p-2 hover:bg-secondary"><SkipBack className="h-7 w-7 fill-current" /></button>
            <button
              onClick={togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
            </button>
            <button onClick={next} aria-label="Suivant" className="rounded-full p-2 hover:bg-secondary"><SkipForward className="h-7 w-7 fill-current" /></button>
            <button onClick={cycleRepeat} className={`rounded-full p-2 transition-colors ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      <AddToPlaylistModal open={showPlaylist} onOpenChange={setShowPlaylist} songId={currentSong.id} />
      <CreateStoryModal open={showStory} onOpenChange={setShowStory} />
    </>
  );
}
