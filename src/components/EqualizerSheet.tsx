import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePlayer } from '@/contexts/PlayerContext';
import { EQ_PRESETS } from '@/lib/eqPresets';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EqualizerSheet({ open, onClose }: Props) {
  const { currentEqPreset, setEqPreset } = usePlayer();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Égaliseur</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2 pb-4">
          {EQ_PRESETS.map((preset) => {
            const active = currentEqPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => { setEqPreset(preset.id); onClose(); }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-[background-color,box-shadow] duration-150 text-left',
                  active
                    ? 'bg-primary/15 ring-1 ring-primary/40'
                    : 'bg-card/60 hover:bg-card/80'
                )}
              >
                <span className="text-xl">{preset.emoji}</span>
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold truncate', active && 'text-primary')}>
                    {preset.name}
                  </p>
                  {/* Mini visualisation des gains */}
                  <div className="mt-1.5 flex items-end gap-0.5 h-4">
                    {preset.gains.map((g, i) => {
                      const height = Math.max(2, Math.round(((g + 10) / 20) * 16));
                      return (
                        <div
                          key={i}
                          className={cn(
                            'w-2 rounded-sm',
                            active ? 'bg-primary/70' : 'bg-muted-foreground/40'
                          )}
                          style={{ height: `${height}px` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
