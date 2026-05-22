import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor, ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function DownloadAppModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Téléchargement hors connexion
          </DialogTitle>
          <DialogDescription>
            Pour télécharger des titres et les écouter hors connexion, tu dois
            installer l'application officielle Jux Music sur ton téléphone ou
            ton ordinateur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div className="flex-1 text-sm">
              <p className="font-medium">App Android</p>
              <p className="text-xs text-muted-foreground">Téléchargement & lecture hors-ligne</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Monitor className="h-5 w-5 text-primary" />
            <div className="flex-1 text-sm">
              <p className="font-medium">App Windows</p>
              <p className="text-xs text-muted-foreground">Bibliothèque locale sur ton PC</p>
            </div>
          </div>
        </div>

        <Button asChild className="w-full">
          <a href="https://juxstore.lovable.app" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Aller sur Jux-Store
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
