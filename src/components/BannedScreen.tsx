import { Ban, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BannedScreenProps {
  onLogout: () => void;
}

/** Écran plein écran affiché aux utilisateurs bannis : bloque tout accès à l'app. */
export default function BannedScreen({ onLogout }: BannedScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-background px-6 py-12 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Compte banni</h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Votre accès à Jux Music a été suspendu par un administrateur. Vous ne pouvez plus utiliser l'application.
        </p>
      </div>
      <Button variant="outline" className="w-full max-w-xs rounded-xl font-semibold" onClick={onLogout}>
        <LogOut className="mr-1.5 h-4 w-4" />Déconnexion
      </Button>
    </div>
  );
}
