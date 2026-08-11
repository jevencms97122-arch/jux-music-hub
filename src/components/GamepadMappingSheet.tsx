import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Gamepad2, RotateCcw, X } from 'lucide-react';
import {
  GAMEPAD_ACTIONS,
  getGamepadMapping,
  setActionBinding,
  resetGamepadMapping,
  setRemappingInProgress,
  comboLabel,
  buttonLabel,
  type GamepadActionId,
  type GamepadMapping,
} from '@/lib/gamepadMapping';
import { cn } from '@/lib/utils';

export default function GamepadMappingSheet({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<GamepadMapping>(() => getGamepadMapping());
  const [listeningFor, setListeningFor] = useState<GamepadActionId | null>(null);
  const [heldPreview, setHeldPreview] = useState<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const maxSetRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (open) setMapping(getGamepadMapping());
    else setListeningFor(null);
  }, [open]);

  const stopListening = useCallback(() => {
    setListeningFor(null);
    setHeldPreview([]);
    maxSetRef.current = new Set();
    setRemappingInProgress(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // Capture d'un nouveau combo pour l'action en cours d'écoute
  useEffect(() => {
    if (!listeningFor) return;
    setRemappingInProgress(true);
    const timeoutAt = Date.now() + 10000;

    const poll = () => {
      const gp = Array.from(navigator.getGamepads()).find((g) => g !== null);
      if (gp) {
        const held: number[] = [];
        gp.buttons.forEach((b, i) => { if (b.pressed) held.push(i); });
        held.forEach((i) => maxSetRef.current.add(i));
        setHeldPreview(held);

        // Relâchement après avoir tenu au moins une touche -> on finalise le combo
        if (held.length === 0 && maxSetRef.current.size > 0) {
          const combo = Array.from(maxSetRef.current).sort((a, b) => a - b);
          setActionBinding(listeningFor, combo);
          setMapping(getGamepadMapping());
          stopListening();
          return;
        }
      }
      if (Date.now() > timeoutAt) {
        stopListening();
        return;
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      setRemappingInProgress(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [listeningFor, stopListening]);

  const handleClear = (actionId: GamepadActionId) => {
    setActionBinding(actionId, []);
    setMapping(getGamepadMapping());
  };

  const handleReset = () => {
    resetGamepadMapping();
    setMapping(getGamepadMapping());
    stopListening();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle>Mappage manette</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
          {GAMEPAD_ACTIONS.map((action) => {
            const combo = mapping[action.id] ?? [];
            const isListening = listeningFor === action.id;
            return (
              <div
                key={action.id}
                className={cn(
                  'rounded-xl px-3 py-3 border',
                  isListening ? 'bg-primary/10 border-primary/40' : 'bg-card/60 border-transparent'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{action.label}</p>
                    {action.description && (
                      <p className="text-[11px] text-muted-foreground">{action.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isListening && (
                      <>
                        <span className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-semibold',
                          combo.length ? 'bg-secondary text-foreground' : 'text-muted-foreground'
                        )}>
                          {comboLabel(combo)}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setListeningFor(action.id)}>
                          Remapper
                        </Button>
                        {combo.length > 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label="Désactiver cette action"
                            onClick={() => handleClear(action.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isListening && (
                  <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Gamepad2 className="h-4 w-4 text-primary shrink-0 animate-pulse" />
                      <p className="text-xs text-muted-foreground truncate">
                        {heldPreview.length > 0
                          ? `Maintenu : ${heldPreview.map(buttonLabel).join(' + ')}`
                          : 'Appuie sur une touche (ou plusieurs ensemble pour un combo), puis relâche...'}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={stopListening}>
                      Annuler
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 flex-shrink-0">
          <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser le mappage par défaut
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
