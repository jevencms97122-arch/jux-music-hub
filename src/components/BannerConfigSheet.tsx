import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { useBannerMediaMode } from '@/hooks/useBannerMediaMode';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (url: string) => void;
}

/** Configuration de la bannière de profil par lien direct (vidéo ou GIF). */
export default function BannerConfigSheet({ open, onOpenChange, value, onChange }: Props) {
  const { mode, onVideoError, onImageError } = useBannerMediaMode(value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle>Bannière de profil</SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          <Input
            type="url"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://exemple.com/ma-video.mp4"
            className="h-11 border-white/10 bg-white/[0.05] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
          />
          <p className="text-[10px] text-muted-foreground/60">
            Lien direct vers une vidéo (.mp4, .webm…) ou un GIF (ex: un lien GIPHY) —
            affiché en fond de ton profil. Les liens YouTube/Instagram ne fonctionnent pas ici.
          </p>

          {value && (
            <div className="relative h-28 w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
              {mode === 'failed' ? (
                <p className="flex h-full items-center justify-center px-4 text-center text-xs text-destructive">
                  Impossible de charger ce lien — vérifie qu'il pointe directement vers un fichier
                </p>
              ) : mode === 'video' ? (
                <video
                  key={value}
                  src={value}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={onVideoError}
                />
              ) : (
                <img key={value} src={value} alt="" className="h-full w-full object-cover" onError={onImageError} />
              )}
            </div>
          )}

          <div className="flex gap-2">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); onOpenChange(false); }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />Retirer
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-elegant-sm"
            >
              Terminé
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
