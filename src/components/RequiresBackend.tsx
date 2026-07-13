import { CloudOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function RequiresBackend() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <CloudOff className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-bold">Indisponible en mode hors connexion</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Cette fonctionnalité nécessite une connexion au serveur. Reconnecte-toi à internet pour y accéder.
      </p>
      <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={() => navigate('/jux')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />Retour à l'accueil
      </Button>
    </div>
  );
}
