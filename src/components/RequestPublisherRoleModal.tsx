import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic2, MessageSquareText } from 'lucide-react';
import { openExternalLink } from '@/lib/openExternalLink';

const DISCORD_INVITE_URL = 'https://discord.gg/pRj8s8c4BB';

interface RequestPublisherRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RequestPublisherRoleModal({ open, onOpenChange }: RequestPublisherRoleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mic2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Devenir Publicateur</DialogTitle>
          <DialogDescription className="text-center">
            Pour commencer à publier des musiques, vous devez demander le rôle aux administrateurs
            sur le serveur Discord <span className="font-semibold text-foreground">Nexora Music</span>.
            Faites votre ticket dans le salon{' '}
            <span className="font-semibold text-foreground">#obtenir-rôle-publicateur</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full rounded-xl bg-gradient-primary font-semibold"
            onClick={() => openExternalLink(DISCORD_INVITE_URL)}
          >
            <MessageSquareText className="mr-1.5 h-4 w-4" />
            Rejoindre le serveur Discord
          </Button>
          <Button variant="ghost" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
