import { useEffect, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Minus, Plus } from 'lucide-react';

interface PlaybackRateControlProps {
  open: boolean;
  onClose: () => void;
}

const RATE_STEPS = 0.01;
const RATE_MIN = 0.5;
const RATE_MAX = 2;

export default function PlaybackRateControl({ open, onClose }: PlaybackRateControlProps) {
  const { playbackRate, setPlaybackRate } = usePlayer();
  const panelRef = useRef<HTMLDivElement>(null);

  // Fermer en cliquant à l'extérieur
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, onClose]);

  if (!open) return null;

  const decrease = () => {
    const next = Math.round((playbackRate - RATE_STEPS) * 100) / 100;
    setPlaybackRate(Math.max(RATE_MIN, next));
  };

  const increase = () => {
    const next = Math.round((playbackRate + RATE_STEPS) * 100) / 100;
    setPlaybackRate(Math.min(RATE_MAX, next));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-28">
      {/* Overlay transparent pour fermer */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />

      {/* Panel vitesse */}
      <div
        ref={panelRef}
        className="relative flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-elegant backdrop-blur-xl"
        style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <button
          onClick={decrease}
          aria-label="Diminuer la vitesse"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 transition-colors hover:bg-secondary active:scale-95"
        >
          <Minus className="h-4 w-4" />
        </button>

        <input
          type="range"
          min={RATE_MIN}
          max={RATE_MAX}
          step={RATE_STEPS}
          value={playbackRate}
          onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
          className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-secondary accent-primary outline-none
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
        />

        <button
          onClick={increase}
          aria-label="Augmenter la vitesse"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 transition-colors hover:bg-secondary active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>

        <span className="w-14 text-right text-sm font-medium tabular-nums text-foreground">
          {Math.round(playbackRate * 100)}%
        </span>
      </div>
    </div>
  );
}