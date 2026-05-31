import { useEffect, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  open: boolean;
  onClose: () => void;
}

export default function VolumeControl({ open, onClose }: VolumeControlProps) {
  const { volume, setVolume } = usePlayer();
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

  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-28">
      {/* Overlay transparent pour fermer */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />

      {/* Panel volume */}
      <div
        ref={panelRef}
        className="relative flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-elegant backdrop-blur-xl"
        style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <Icon className="h-5 w-5 text-muted-foreground" />

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-secondary accent-primary outline-none
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
        />

        <span className="w-10 text-right text-sm font-medium tabular-nums text-foreground">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}