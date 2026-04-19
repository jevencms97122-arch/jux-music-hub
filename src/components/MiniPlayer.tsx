import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { Play, Pause, SkipForward } from 'lucide-react';

export default function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, next, openPlayer, currentTime, duration } = usePlayer();
  if (!currentSong) return null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 mx-2 rounded-lg border border-border bg-card shadow-lg">
      <div className="h-1 w-full bg-secondary">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center gap-3 p-2">
        <button onClick={openPlayer} className="flex flex-1 items-center gap-3 min-w-0">
          <img
            src={songCoverUrl(currentSong)}
            alt={currentSong.title}
            className="h-10 w-10 rounded object-cover"
          />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-medium text-foreground">{currentSong.title}</p>
            <p className="truncate text-xs text-muted-foreground">{currentSong.author}</p>
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="rounded-full p-2 hover:bg-secondary"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="rounded-full p-2 hover:bg-secondary"
          aria-label="Suivant"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
