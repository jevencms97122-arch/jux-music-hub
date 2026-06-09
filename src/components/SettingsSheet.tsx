import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useReactiveBg } from '@/hooks/useReactiveBg';
import { LogOut, Sparkles } from 'lucide-react';

export default function SettingsSheet({ trigger }: { trigger: React.ReactNode }) {
  const { logout } = useAuth();
  const { enabled, setEnabled } = useReactiveBg();

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle>Paramètres</SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {/* Arrière-plan réactif */}
          <div className="flex items-center justify-between rounded-2xl bg-card/60 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15">
                <Sparkles className="h-4.5 w-4.5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Arrière-plan réactif</p>
                <p className="text-xs text-muted-foreground">Le fond du lecteur s'anime avec la musique</p>
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        {/* Séparateur */}
        <div className="my-6 h-px bg-border/50" />

        {/* Déconnexion */}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-semibold">Se déconnecter</span>
        </button>
      </SheetContent>
    </Sheet>
  );
}
