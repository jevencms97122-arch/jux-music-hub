import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Download, MonitorDown } from 'lucide-react';
import { openExternalLink } from '@/lib/openExternalLink';

const DOWNLOAD_URL = 'https://cdn.discordapp.com/attachments/1542135134063693834/1542135805667967026/Nexora-Convert_1.0.0_x64-setup.exe?ex=6a902163&is=6a8ecfe3&hm=9693a27fa13252e50204f1b326dfa93c0e3a7485aa6388afa8de84e90d8df0e8&';

export default function NexoraConvertSheet({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle>Nexora-Convert</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <Download className="h-7 w-7 text-primary" />
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Nexora-Convert est une application qui permet de télécharger des médias depuis une URL. Elle fonctionne
            avec YouTube, ainsi qu'un grand nombre d'autres sites (SoundCloud, Vimeo, Twitter/X, TikTok, Twitch,
            Dailymotion, et bien d'autres).
          </p>

          <div className="flex items-center gap-2 rounded-2xl bg-card/60 p-4">
            <MonitorDown className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Disponible uniquement sur <span className="font-semibold text-foreground">Windows</span> pour le moment.
            </p>
          </div>

          <Button size="default" className="w-full gap-2" onClick={() => openExternalLink(DOWNLOAD_URL)}>
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
