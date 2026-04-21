import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { songCoverUrl } from '@/lib/storage';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, MoreHorizontal, Heart, ListPlus, Sparkles, Headphones } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useEffect, useState, useRef } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreateStoryModal from './CreateStoryModal';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

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
    playbackRate, setPlaybackRate,
  } = usePlayer();
  const [seeking, setSeeking] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showLikeAnim, setShowLikeAnim] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    if (!authUser || !currentSong) { setLiked(false); return; }
    supabase
      .from('song_likes').select('id')
      .eq('song_id', currentSong.id).eq('user_id', authUser.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [authUser, currentSong]);

  const toggleLike = async () => {
    if (!authUser || !currentSong) return;
    if (liked) {
      await supabase.from('song_likes').delete()
        .eq('song_id', currentSong.id).eq('user_id', authUser.id);
      setLiked(false);
    } else {
      await supabase.from('song_likes').insert({ song_id: currentSong.id, user_id: authUser.id });
      setLiked(true);
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowPlaylist(true)}>Ajouter à la playlist</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowStory(true)}>Ajouter à la story</DropdownMenuItem>
                <div className="border-t border-border" />
                {SPEEDS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setPlaybackRate(s)}>
                    {s}x {s < 1 ? '(ralenti)' : s > 1 ? '(accéléré)' : '(normal)'}
                  </DropdownMenuItem>
                ))}
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
                  await toggleLike();
                  setShowLikeAnim(true);
                  setTimeout(() => setShowLikeAnim(false), 800);
                }}
                onTouchStart={() => {
                  const now = Date.now();
                  if (now - lastTap.current < 300) {
                    toggleLike();
                    setShowLikeAnim(true);
                    setTimeout(() => setShowLikeAnim(false), 800);
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
            <div className="flex gap-2">
              <span className="text-xs text-muted-foreground">Actions dans Options</span>
            </div>
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
