import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { checkForUpdates, setDismissedVersion, reloadApp, isPWA, type AppVersion } from '@/lib/pwaVersionCheck';
import { Download, X } from 'lucide-react';

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<AppVersion | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      // Only check for updates if running as PWA
      if (!isPWA()) {
        return;
      }

      const update = await checkForUpdates();
      if (update) {
        setUpdateInfo(update);
        setIsOpen(true);
      }
    };

    // Check immediately on mount
    checkUpdate();

    // Check every 5 minutes
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleInstallUpdate = () => {
    if (updateInfo) {
      setDismissedVersion(updateInfo.last_version);
    }
    reloadApp();
  };

  const handleDismiss = () => {
    // Don't save dismissed version - message will reappear on next visit
    setIsOpen(false);
  };

  if (!updateInfo) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Mise à jour disponible
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Une nouvelle version de Jux-Music est disponible (v{updateInfo.last_version})
              </p>
              {updateInfo.description && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium mb-2">Notes de mise à jour :</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {updateInfo.description}
                  </p>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={handleDismiss} className="gap-2">
            <X className="h-4 w-4" />
            Pas maintenant
          </Button>
          <Button onClick={handleInstallUpdate} className="gap-2">
            <Download className="h-4 w-4" />
            Installer la mise à jour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}