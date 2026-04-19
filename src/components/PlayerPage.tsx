import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Gauge } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useState } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(s: number) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerPage() {
  const {
    currentSong, isPlaying, currentTime, duration, isPlayerOpen,
    closePlayer, togglePlay, next, previous, seek,
    isShuffled, toggleShuffle, repeatMode, cycleRepeat,
    playbackRate, setPlaybackRate,
  } = usePlayer();
  const [seeking, setSeeking] = useState<number | null>(null);

  if (!isPlayerOpen || !currentSong) return null;

  const value = seeking ?? currentTime;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background p-6 animate-in slide-in-from-bottom">
      <div className="flex items-center justify-between">
        <button onClick={closePlayer} aria-label="Fermer">
          <ChevronDown className="h-6 w-6" />
        </button>
        <span className="text-sm text-muted-foreground">En cours</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium hover:bg-secondary">
            <Gauge className="h-4 w-4" /> {playbackRate}x
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SPEEDS.map((s) => (
              <DropdownMenuItem key={s} onClick={() => setPlaybackRate(s)}>
                {s}x {s < 1 ? '(slowed)' : s > 1 ? '(sped up)' : '(normal)'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <img
          src={songCoverUrl(currentSong)}
          alt={currentSong.title}
          className="aspect-square w-full max-w-sm rounded-2xl object-cover shadow-2xl"
        />
      </div>

      <div className="mb-4 text-center">
        <h2 className="text-xl font-bold text-foreground">{currentSong.title}</h2>
        <p className="text-muted-foreground">{currentSong.author}</p>
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
        <button onClick={toggleShuffle} className={isShuffled ? 'text-primary' : 'text-muted-foreground'}>
          <Shuffle className="h-5 w-5" />
        </button>
        <button onClick={previous} aria-label="Précédent"><SkipBack className="h-7 w-7" /></button>
        <button
          onClick={togglePlay}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
        </button>
        <button onClick={next} aria-label="Suivant"><SkipForward className="h-7 w-7" /></button>
        <button onClick={cycleRepeat} className={repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}>
          {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
