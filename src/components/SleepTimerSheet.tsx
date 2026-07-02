import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { Moon, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'Désactivé',  minutes: null },
  { label: '5 min',      minutes: 5 },
  { label: '15 min',     minutes: 15 },
  { label: '30 min',     minutes: 30 },
  { label: '45 min',     minutes: 45 },
  { label: '1 heure',    minutes: 60 },
  { label: '1h 30',      minutes: 90 },
  { label: 'Fin du morceau', minutes: -1 },
];

export default function SleepTimerSheet({ open, onClose }: Props) {
  const { sleepTimerMinutes, sleepTimerRemaining, setSleepTimer } = usePlayer();

  const formatRemaining = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-2">
          <SheetTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            Arrêt automatique
          </SheetTitle>
        </SheetHeader>

        {sleepTimerRemaining !== null && (
          <div className="mb-4 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-primary">
              Arrêt dans <span className="font-bold">{formatRemaining(sleepTimerRemaining)}</span>
            </p>
            <button
              onClick={() => setSleepTimer(null)}
              className="rounded-xl p-1.5 hover:bg-primary/15 text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pb-4">
          {OPTIONS.map((opt) => {
            const active = sleepTimerMinutes === opt.minutes;
            return (
              <button
                key={String(opt.minutes)}
                onClick={() => { setSleepTimer(opt.minutes); if (opt.minutes !== null) onClose(); }}
                className={cn(
                  'rounded-2xl px-4 py-4 text-left transition-all duration-150 font-semibold text-sm',
                  active
                    ? 'bg-primary/15 ring-1 ring-primary/40 text-primary'
                    : 'bg-card/60 hover:bg-card/80 text-foreground'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
