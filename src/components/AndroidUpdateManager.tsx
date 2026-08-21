import { useEffect, useState, useCallback } from 'react';
import { getDetectedPlatform } from '@/lib/versionCheck';
import { checkAndroidUpdate, installAndroidUpdate, type AndroidUpdateInfo } from '@/lib/androidUpdate';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Phase = 'idle' | 'installing' | 'error';

/** Équivalent Android de TauriUpdateManager : vérifie au lancement, bannière discrète
 * si une mise à jour est dispo, déroulé natif (DownloadManager + écran d'install
 * système) au clic — voir JuxMediaBridge.kt. */
export default function AndroidUpdateManager() {
  const [update, setUpdate] = useState<AndroidUpdateInfo | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (getDetectedPlatform() !== 'android-app') return;
    (async () => {
      try {
        const result = await checkAndroidUpdate();
        if (result) setUpdate(result);
      } catch (e) {
        console.error('[AndroidUpdateManager] checkAndroidUpdate failed:', e);
      }
    })();
  }, []);

  const runUpdate = useCallback(() => {
    if (!update) return;
    setErrorMessage(null);
    const started = installAndroidUpdate(update.url);
    if (!started) {
      setErrorMessage("Pont de mise à jour natif indisponible.");
      setPhase('error');
      return;
    }
    setPhase('installing');
  }, [update]);

  if (!update) return null;
  if (bannerDismissed && phase === 'idle') return null;

  return (
    <>
      {phase === 'idle' && !bannerDismissed && (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-3 rounded-full bg-background/90 backdrop-blur-md border border-border/50 px-4 py-2 shadow-elegant">
            <span className="text-xs text-amber-400 font-medium">
              Mise à jour {update.version} disponible
            </span>
            <Button size="sm" className="h-7 px-3 text-xs gap-1.5" onClick={runUpdate}>
              <Download className="h-3 w-3" />
              Mettre à jour
            </Button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === 'installing' && (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 animate-fade-in">
          <div className="rounded-2xl bg-background/90 backdrop-blur-md border border-border/50 px-4 py-2.5 shadow-elegant">
            <p className="text-center text-xs text-muted-foreground">
              Téléchargement en cours (voir la notification) — l'écran d'installation s'ouvrira automatiquement.
            </p>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-3 rounded-full bg-background/90 backdrop-blur-md border border-border/50 px-4 py-2 shadow-elegant">
            <span className="text-xs text-destructive font-medium">{errorMessage ?? 'Échec de la mise à jour.'}</span>
            <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={runUpdate}>
              Réessayer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
