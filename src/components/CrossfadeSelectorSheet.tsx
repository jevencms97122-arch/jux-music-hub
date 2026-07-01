import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { usePlayer, TRANSITION_MODES } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const DEFAULT_TRANSITION_MODE = 'linear';

const VISIBLE_MODES = ['linear', 'tempoShift'];

const OPTIONS = [
  { value: 'none' as const, label: 'Aucun', description: 'Coupure nette, sans fondu entre les morceaux' },
  ...TRANSITION_MODES.filter((m) => VISIBLE_MODES.includes(m.value)),
];

export default function CrossfadeSelectorSheet({
  triggerLabel,
  triggerClassName,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
}) {
  const { crossfadeSeconds, setCrossfadeSeconds, transitionMode, setTransitionMode } = usePlayer();

  const selectedValue = crossfadeSeconds > 0 ? transitionMode : 'none';

  const handleSelect = (value: string) => {
    if (value === 'none') {
      setCrossfadeSeconds(0);
      return;
    }
    setTransitionMode(value as typeof transitionMode);
    if (crossfadeSeconds <= 0) setCrossfadeSeconds(3);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {typeof triggerLabel === 'string' ? (
          <Button variant="secondary" size="sm" className={triggerClassName}>
            {triggerLabel}
          </Button>
        ) : (
          triggerLabel
        )}
      </SheetTrigger>

      <SheetContent side="left" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Fondu enchaîné (crossfade)</SheetTitle>
          <SheetDescription>
            Choisis comment les morceaux s'enchaînent.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {OPTIONS.map((opt) => {
            const isActive = opt.value === selectedValue;
            const isDefault = opt.value === DEFAULT_TRANSITION_MODE;

            return (
              <div key={opt.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    isActive ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary/50 hover:bg-secondary/80',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{opt.label}</span>
                      {isDefault && (
                        <span className="text-[10px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          Par défaut
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </button>

                {isActive && opt.value !== 'none' && (
                  <div className="mt-2 rounded-xl bg-secondary/30 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Durée du fondu</label>
                      <span className="text-xs font-semibold">{crossfadeSeconds.toFixed(1)} s</span>
                    </div>
                    <Slider
                      value={[crossfadeSeconds]}
                      min={1}
                      max={12}
                      step={0.5}
                      onValueChange={(v) => setCrossfadeSeconds(v[0])}
                      className="mt-2 w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
