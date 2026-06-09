import { useMemo } from 'react';
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
  triggerClassName,
}: {
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
}) {
  const { themes, currentTheme, setTheme } = useTheme();

  const hasAnimation = currentTheme.backgroundAnimation != null;

  const themeButtons = useMemo(() => {
    return themes.map((t) => {
      const isActive = t.id === currentTheme.id;

      return (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          aria-label={`Theme ${t.name}`}
          title={t.name}
          className={cn(
            'relative inline-flex items-center justify-center rounded-xl border p-[2px] transition-transform',
            'hover:scale-[1.03]',
            isActive ? 'border-white/90' : 'border-transparent',
          )}
        >
          <span
            className={cn(
              PREVIEW_SIZE_CLASS,
              'rounded-[9px]'
            )}
            style={{
              background: t.background,
              backgroundSize: t.backgroundAnimation ? '200% 200%' : undefined,
            }}
          />
          {t.backgroundAnimation && (
            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 px-1 text-[8px] font-bold text-white leading-none py-[1px]">
              ✦
            </span>
          )}
          {!t.backgroundAnimation && isActive && (
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
          <SheetTitle>Thème de l’application</SheetTitle>
          <SheetDescription>
            Choisis une ambiance (statiques ou animées).
            {hasAnimation && (
              <span className="mt-1 block text-xs text-purple-400">
                ✦ Animé • se met en pause au focus perdu
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aperçus
          </div>
          <div className="flex flex-wrap gap-3">
            {themeButtons}
          </div>

          <div className="mt-5 rounded-xl border bg-secondary/40 p-4">
            <div className="text-sm font-semibold">Actif</div>
            <div className="mt-1 text-xs text-muted-foreground">{currentTheme.name}</div>

            <div
              className="mt-3 h-16 w-full rounded-lg border"
              style={{
                background: currentTheme.background,
                backgroundSize: currentTheme.backgroundAnimation ? '200% 200%' : undefined,
                animation: currentTheme.backgroundAnimation ?? undefined,
              }}
            />
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
