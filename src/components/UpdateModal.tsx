import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDownloadUrl, getReleaseNotes } from '@/lib/versionCheck';

interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
  latestVersion: string;
}

export default function UpdateModal({ open, onClose, latestVersion }: UpdateModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Exclamation icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-3xl font-extrabold text-amber-400">!</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold text-foreground">Mise à jour disponible</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Une mise à jour est disponible pour Nexora Music Ver {latestVersion}
          </p>
        </div>

        {/* Description */}
        <div className="mb-6 rounded-xl bg-secondary/50 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {getReleaseNotes()}
          </p>
        </div>

        {/* Button */}
        <Button
          size="default"
          className="w-full gap-2 text-sm font-semibold shadow-lg"
          asChild
        >
          <a
            href={getDownloadUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="h-4 w-4" />
            Mettre à jour depuis Jux-Store
          </a>
        </Button>
      </div>
    </div>
  );
}