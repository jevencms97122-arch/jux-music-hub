import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Heart, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const IBAN = 'FR76 4061 8805 1100 0402 4921 374';
const HOLDER = 'Jules EVEN';

export default function DonationSheet({ trigger }: { trigger: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(IBAN.replace(/\s+/g, ''));
      setCopied(true);
      toast.success('IBAN copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle>Faire un don</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
              <Heart className="h-7 w-7 text-rose-400" />
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Nexora Music est développé bénévolement. Si tu veux soutenir le projet, un virement bancaire est le
            moyen le plus simple.
          </p>

          <div className="rounded-2xl bg-card/60 p-4 space-y-3">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Titulaire</div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">{HOLDER}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">IBAN</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-foreground tracking-wide">{IBAN}</div>
            </div>
          </div>

          <Button size="default" className="w-full gap-2" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier l\'IBAN'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
