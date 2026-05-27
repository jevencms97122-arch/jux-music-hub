import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const PREVIEW_SIZE_CLASS = 'h-10 w-10 sm:h-11 sm:w-11';

export default function ThemeSelectorSheet({
  triggerLabel,
}: {
  triggerLabel: React.ReactNode;
}) {
  const { themes, currentTheme, setTheme } = useTheme();

  const themeButtons = useMemo(() => {
    return themes.map((t, idx) => {
      const isActive = t.id === currentTheme.id;

      // Optionnel : certains thèmes "lockés" pour effet premium (simple rule)
      const locked = idx % 3 === 2; // 0-1 unlocked, 2 locked, etc.

      return (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            if (locked) return;
            setTheme(t.id);
          }}
          aria-label={`Theme ${t.name}`}
          className={cn(
            'relative inline-flex items-center justify-center rounded-xl border p-[2px] transition-transform',
            'hover:scale-[1.03]',
            isActive ? 'border-white/90' : 'border-transparent',
            locked ? 'opacity-70 grayscale' : 'opacity-100 grayscale-0',
          )}
        >
          <span
            className={cn(
              PREVIEW_SIZE_CLASS,
              'rounded-[9px] bg-cover bg-center'
            )}
            style={{ backgroundImage: t.background.includes('gradient') ? t.background : undefined, background: t.background }}
          />
          {locked && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-black/40 backdrop-blur">
                <Lock className="h-4 w-4 text-white" />
              </span>
            </span>
          )}
          {!locked && isActive && (
            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-white p-1">
              <span className="block h-2.5 w-2.5 rounded-full bg-black/80" />
            </span>
          )}
        </button>
      );
    });
  }, [currentTheme.id, setTheme, themes]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          {triggerLabel}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Thème de l’application</SheetTitle>
          <SheetDescription>Choisis une ambiance type Nitro (unies + fondus).</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aperçus
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {themeButtons}
          </div>

          <div className="mt-5 rounded-xl border bg-secondary/40 p-4">
            <div className="text-sm font-semibold">Actif</div>
            <div className="mt-1 text-xs text-muted-foreground">{currentTheme.name}</div>

            <div
              className="mt-3 h-16 w-full rounded-lg border"
              style={{ background: currentTheme.background }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
