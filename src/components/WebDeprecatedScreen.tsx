import { Button } from '@/components/ui/button';
import { ExternalLink, Smartphone, Monitor } from 'lucide-react';

const JUX_STORE_URL = 'https://juxstore.lovable.app/app/4e44fb8c-839e-494d-b0a9-cf92d9c4fafb';

export default function WebDeprecatedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant">
          <span className="text-2xl font-extrabold text-primary-foreground">J</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            Jux Music a changé d'adresse
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Le site web n'est plus maintenu. Jux Music est désormais disponible
            uniquement sous forme d'application sur <strong>Android</strong> et{' '}
            <strong>PC</strong>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pour télécharger l'app et recevoir les mises à jour, rends-toi sur
            la page officielle de Jux Music sur <strong>Jux-Store</strong>.
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-left">
            <Smartphone className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">App Android</p>
              <p className="text-xs text-muted-foreground">Lecture & téléchargements hors-ligne</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-left">
            <Monitor className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">App Windows</p>
              <p className="text-xs text-muted-foreground">Bibliothèque locale sur ton PC</p>
            </div>
          </div>
        </div>

        <Button asChild size="lg" className="w-full">
          <a href={JUX_STORE_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Aller sur Jux-Store
          </a>
        </Button>
      </div>
    </div>
  );
}
