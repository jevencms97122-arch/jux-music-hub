import { useCallback, useRef, useState } from 'react';

interface Props {
  holdMs?: number;
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  className?: string;
}

/**
 * Bouton "maintenir appuyé N secondes pour confirmer" — seconde barrière de
 * confirmation pour une action destructrice (voir MySongsSheet). Le relâchement
 * avant la fin annule et remet la progression à zéro.
 */
export default function HoldToConfirmButton({ holdMs = 10000, label, holdingLabel, onConfirm, className }: Props) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setHolding(true);
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / holdMs);
      setProgress(p);
      if (p >= 1) {
        stop();
        onConfirm();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onConfirm, stop]);

  const secondsLeft = Math.max(0, Math.ceil((holdMs / 1000) * (1 - progress)));

  return (
    <button
      type="button"
      className={`relative w-full overflow-hidden rounded-xl bg-destructive/15 border border-destructive/40 py-3 text-sm font-bold text-destructive select-none touch-none ${className ?? ''}`}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
    >
      <div
        className="absolute inset-y-0 left-0 bg-destructive/30 transition-[width] duration-75 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">
        {holding ? (holdingLabel ?? `Maintiens... ${secondsLeft}s`) : label}
      </span>
    </button>
  );
}
