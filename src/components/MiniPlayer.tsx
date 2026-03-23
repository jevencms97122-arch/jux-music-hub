import { usePlayer } from '@/contexts/PlayerContext';
import { getSongCoverUrl } from '@/lib/pocketbase';
import { Play, Pause, SkipForward } from 'lucide-react';

export default function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, next, setPlayerOpen, progress, duration } = usePlayer();
  if (!currentSong) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="fixed bottom-14 left-0 right-0 z-40 bg-card border-t border-border safe-bottom cursor-pointer"
      onClick={() => setPlayerOpen(true)}
    >
      <div className="h-0.5 bg-secondary">
        <div className="h-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <img
          src={getSongCoverUrl(currentSong)}
          alt={currentSong.title}
          className="h-10 w-10 rounded object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{currentSong.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentSong.author}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="p-2 text-foreground">
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button onClick={e => { e.stopPropagation(); next(); }} className="p-2 text-foreground">
          <SkipForward className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
