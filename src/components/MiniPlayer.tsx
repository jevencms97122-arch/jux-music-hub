import { useState, useRef, useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import CachedImage from '@/components/CachedImage';
import VolumeControl from '@/components/VolumeControl';
import { cn } from '@/lib/utils';

export default function MiniPlayer() {
  const { currentSong, isPlaying, isBuffering, togglePlay, next, openPlayer, currentTime, duration } = usePlayer();
  const [volumeOpen, setVolumeOpen] = useState(false);
  const prevIdRef = useRef<string | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (currentSong && currentSong.id !== prevIdRef.current) {
      prevIdRef.current = currentSong.id;
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 500);
      return () => clearTimeout(t);
    }
  }, [currentSong]);

  if (!currentSong) return null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div
        className={cn('glass fixed bottom-[76px] left-3 right-3 z-40 overflow-hidden rounded-2xl', animate ? 'animate-slide-in-right' : '')}
      >
        {/* Progress bar */}
        <div className="h-[2px] w-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-primary"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Album art + title */}
          <button onClick={openPlayer} className="flex flex-1 items-center gap-3 min-w-0">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl shadow-soft">
              <CachedImage
                src={songCoverUrl(currentSong)}
                alt={currentSong.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.08]" />
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-[13px] font-semibold text-foreground">{currentSong.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{currentSong.author}</p>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setVolumeOpen(true); }}
              className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
              aria-label="Volume"
            >
              <Volume2 className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="rounded-xl bg-gradient-primary p-2.5 text-primary-foreground shadow-elegant-sm hover:shadow-glow active:scale-95"
              aria-label={isBuffering ? 'Chargement' : isPlaying ? 'Pause' : 'Play'}
            >
              {isBuffering
                ? <div className="h-4.5 w-4.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                : isPlaying
                  ? <Pause className="h-4.5 w-4.5 fill-current" />
                  : <Play className="h-4.5 w-4.5 fill-current" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
              aria-label="Suivant"
            >
              <SkipForward className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      <VolumeControl open={volumeOpen} onClose={() => setVolumeOpen(false)} />
    </>
  );
}
