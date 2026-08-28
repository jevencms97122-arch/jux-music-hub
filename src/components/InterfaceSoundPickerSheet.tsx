import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Play, Check, VolumeX } from 'lucide-react';
import {
  getInterfaceSoundOptions,
  getSelectedInterfaceSfxId,
  setSelectedInterfaceSfxId,
  playSfxUrl,
  NONE_SFX_ID,
} from '@/lib/interfaceSounds';
import { cn } from '@/lib/utils';

interface Props {
  categoryId: string;
  categoryLabel: string;
  trigger: React.ReactNode;
}

export default function InterfaceSoundPickerSheet({ categoryId, categoryLabel, trigger }: Props) {
  const [selected, setSelected] = useState<string | null>(() => getSelectedInterfaceSfxId(categoryId));
  const options = getInterfaceSoundOptions(categoryId);

  const handleSelect = (id: string, url?: string) => {
    setSelected(id);
    setSelectedInterfaceSfxId(categoryId, id);
    if (url) playSfxUrl(url);
  };

  const isNoneSelected = !selected || selected === NONE_SFX_ID;

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle>{categoryLabel}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <button
              onClick={() => handleSelect(NONE_SFX_ID)}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors',
                isNoneSelected ? 'bg-primary/10 border border-primary/40' : 'hover:bg-card/60 border border-transparent'
              )}
            >
              <div className="flex items-center gap-2.5">
                <VolumeX className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Aucun son</span>
              </div>
              {isNoneSelected && <Check className="h-4 w-4 text-primary" />}
            </button>

            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Aucun son disponible. Ajoute des fichiers dans src/assets/sfx/interface/ nommés "{categoryId}__nom.mp3".
              </p>
            ) : (
              options.map((sfx) => {
                const isSelected = selected === sfx.id;
                return (
                  <button
                    key={sfx.id}
                    onClick={() => handleSelect(sfx.id, sfx.url)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors',
                      isSelected ? 'bg-primary/10 border border-primary/40' : 'hover:bg-card/60 border border-transparent'
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{sfx.label}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); playSfxUrl(sfx.url); }}
                        aria-label="Écouter"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
