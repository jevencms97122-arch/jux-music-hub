import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileQrCodeProps {
  trigger?: React.ReactNode;
}

export default function ProfileQrCode({ trigger }: ProfileQrCodeProps) {
  const { profile, authUser } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);

  const profileUrl = authUser
    ? `${window.location.origin}/u/${authUser.id}`
    : '';

  useEffect(() => {
    if (!open || !authUser || !profile) return;

    let cancelled = false;

    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = profileUrl;

        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('QR generation failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [open, authUser, profile, profileUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Lien copié !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `jux-${profile?.pseudo ?? 'profil'}-qr.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success('QR code téléchargé !');
  };

  const handleShare = async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }
    try {
      // Convert data URL to blob for sharing
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `jux-${profile?.pseudo ?? 'profil'}-qr.png`, { type: 'image/png' });
      await navigator.share({
        title: `Profil Jux de ${profile?.pseudo ?? ''}`,
        text: `Rejoins-moi sur Jux Music ! 👉 ${profileUrl}`,
        files: [file],
      });
    } catch {
      // User cancelled or share not supported
      handleCopyLink();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label="QR Code profil">
            <QrCode className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xs sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Mon profil Jux</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {qrDataUrl ? (
            <div className="rounded-2xl border border-border bg-white p-4 shadow-elegant">
              <img
                src={qrDataUrl}
                alt="QR Code profil"
                className="h-56 w-56"
              />
            </div>
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-secondary animate-pulse">
              <QrCode className="h-10 w-10 text-muted-foreground" />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Scanne ce QR code avec ton téléphone pour voir mon profil et t'abonner instantanément
          </p>

          <div className="flex w-full gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copié' : 'Lien'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Télécharger
            </Button>
            {typeof navigator.share !== 'undefined' && (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleShare}>
                <Share2 className="h-4 w-4" /> Partager
              </Button>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}