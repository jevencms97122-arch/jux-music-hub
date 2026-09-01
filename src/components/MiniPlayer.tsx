import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import CachedImage from '@/components/CachedImage';
import VolumeControl from '@/components/VolumeControl';

type Anchor = 'top' | 'bottom';
type Side = 'left' | 'right';

const ANCHOR_KEY = 'miniplayer_anchor';
const HIDDEN_KEY = 'miniplayer_hidden';
const SIDE_KEY = 'miniplayer_side';

/** Seuils de geste : distance en px OU vélocité en px/s. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 500;
const MOVE_DISTANCE = 70;
const MOVE_VELOCITY = 450;

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 36, mass: 0.8 };

export default function MiniPlayer() {
  const { currentSong, isPlaying, isBuffering, togglePlay, next, openPlayer, currentTime, duration } = usePlayer();
  const [volumeOpen, setVolumeOpen] = useState(false);

  const [anchor, setAnchor] = useState<Anchor>(() =>
    localStorage.getItem(ANCHOR_KEY) === 'top' ? 'top' : 'bottom'
  );
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDDEN_KEY) === '1');
  const [side, setSide] = useState<Side>(() =>
    localStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right'
  );

  // Un drag se termine par un click natif : on l'ignore pour ne pas ouvrir le player.
  const draggedAt = useRef(0);

  useEffect(() => { localStorage.setItem(ANCHOR_KEY, anchor); }, [anchor]);
  useEffect(() => { localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0'); }, [hidden]);
  useEffect(() => { localStorage.setItem(SIDE_KEY, side); }, [side]);

  if (!currentSong) return null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const offsets = anchor === 'top'
    ? { top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }
    : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    draggedAt.current = Date.now();
    const { offset, velocity } = info;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);

    if (horizontal) {
      if (Math.abs(offset.x) > DISMISS_DISTANCE || Math.abs(velocity.x) > DISMISS_VELOCITY) {
        setSide(offset.x < 0 ? 'left' : 'right');
        setHidden(true);
      }
      return;
    }
    if (offset.y < -MOVE_DISTANCE || velocity.y < -MOVE_VELOCITY) setAnchor('top');
    else if (offset.y > MOVE_DISTANCE || velocity.y > MOVE_VELOCITY) setAnchor('bottom');
  };

  const guardClick = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - draggedAt.current < 250) return;
    fn();
  };

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        {hidden ? (
          <motion.button
            key="pill"
            onClick={() => setHidden(false)}
            aria-label="Afficher le mini lecteur"
            className="glass fixed z-40 h-11 w-11 overflow-hidden rounded-full shadow-elegant-sm"
            style={{ ...offsets, [side]: 12 }}
            initial={{ opacity: 0, scale: 0.6, x: side === 'left' ? -40 : 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.6, x: side === 'left' ? -40 : 40 }}
            transition={SPRING}
            whileTap={{ scale: 0.92 }}
          >
            <CachedImage
              src={songCoverUrl(currentSong)}
              alt={currentSong.title}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/[0.12]" />
            {isPlaying && (
              <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-primary/70 animate-pulse" />
            )}
          </motion.button>
        ) : (
          <motion.div
            key="bar"
            drag
            dragDirectionLock
            dragSnapToOrigin
            dragElastic={{ top: 0.5, bottom: 0.5, left: 0.85, right: 0.85 }}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
            className="glass fixed left-3 right-3 z-40 cursor-grab overflow-hidden rounded-2xl active:cursor-grabbing"
            style={offsets}
            initial={{ opacity: 0, scale: 0.94, x: side === 'left' ? -40 : 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: side === 'left' ? -320 : 320 }}
            transition={SPRING}
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
              <button onClick={guardClick(openPlayer)} className="flex flex-1 items-center gap-3 min-w-0">
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
                  onClick={guardClick(() => setVolumeOpen(true))}
                  className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
                  aria-label="Volume"
                >
                  <Volume2 className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={guardClick(togglePlay)}
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
                  onClick={guardClick(next)}
                  className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
                  aria-label="Suivant"
                >
                  <SkipForward className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VolumeControl open={volumeOpen} onClose={() => setVolumeOpen(false)} />
    </>
  );
}
