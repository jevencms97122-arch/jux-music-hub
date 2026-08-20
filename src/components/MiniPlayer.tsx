import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import CachedImage from '@/components/CachedImage';
import VolumeControl from '@/components/VolumeControl';

export default function MiniPlayer() {
  const { currentSong, isPlaying, isBuffering, togglePlay, next, openPlayer, currentTime, duration } = usePlayer();
  const [volumeOpen, setVolumeOpen] = useState(false);

  if (!currentSong) return null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div className="glass fixed bottom-[76px] left-3 right-3 z-40 overflow-hidden rounded-2xl">
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
              <AnimatePresence initial={false}>
                <motion.div
                  key={currentSong.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <CachedImage
                    src={songCoverUrl(currentSong)}
                    alt={currentSong.title}
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.08] z-10" />
            </div>
            <div className="min-w-0 text-left overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentSong.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <p className="truncate text-[13px] font-semibold text-foreground">{currentSong.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{currentSong.author}</p>
                </motion.div>
              </AnimatePresence>
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
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
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
