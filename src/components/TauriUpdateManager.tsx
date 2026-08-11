import { useEffect, useState, useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { UPDATE_TRANSITION_KEY } from '@/lib/updateTransition';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Phase = 'idle' | 'downloading' | 'installing' | 'error';

/** Gère la mise à jour desktop (Tauri) : vérifie au démarrage, force ou notifie selon `forced`. */
export default function TauriUpdateManager() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [forced, setForced] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0); // 0-100
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const result = await check();
        if (!result) return;
        setUpdate(result);
        const raw = result.rawJson as Record<string, unknown> | undefined;
        setForced(raw?.forced === true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[TauriUpdateManager] check() failed:', msg, e);
      }
    })();
  }, []);

  const runUpdate = useCallback(async () => {
    if (!update) return;
    setPhase('downloading');
    setProgress(0);
    setErrorMessage(null);
    let total = 0;
    let downloaded = 0;
    try {
      // Mémorise la transition de version AVANT de lancer l'install : au prochain
      // démarrage, si la version tourne bien vers `to`, on affiche les notes.
      try {
        const from = await getVersion();
        localStorage.setItem(UPDATE_TRANSITION_KEY, JSON.stringify({ from, to: update.version }));
      } catch { /* noop */ }
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (total > 0) setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
            break;
          case 'Finished':
            setProgress(100);
            setPhase('installing');
            break;
        }
      });
      await relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[TauriUpdateManager] downloadAndInstall failed:', msg, e);
      setErrorMessage(msg);
      setPhase('error');
    }
  }, [update]);

  if (!update) return null;

  // Bannière discrète (maj non forcée)
  if (!forced) {
    if (bannerDismissed && phase === 'idle') return null;
    return (
      <>
        {phase === 'idle' && !bannerDismissed && (
          <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 animate-fade-in">
            <div className="flex items-center gap-3 rounded-full bg-background/90 backdrop-blur-md border border-border/50 px-4 py-2 shadow-elegant">
              <span className="text-xs text-amber-400 font-medium">
                Mise à jour {update.version} disponible
              </span>
              <Button size="sm" className="h-7 px-3 text-xs" onClick={runUpdate}>
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
        {phase !== 'idle' && (
          <UpdateProgressOverlay
            phase={phase}
            progress={progress}
            version={update.version}
            closable={false}
            errorMessage={errorMessage}
            onRetry={runUpdate}
          />
        )}
      </>
    );
  }

  // Mise à jour forcée : overlay non fermable
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl mx-4">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-3xl font-extrabold text-amber-400">!</span>
          </div>
        </div>
        <div className="mb-4 text-center">
          <h2 className="text-xl font-bold text-foreground">Mise à jour requise</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Une mise à jour obligatoire ({update.version}) doit être installée pour continuer.
          </p>
        </div>
        {update.body && (
          <div className="mb-6 rounded-xl bg-secondary/50 p-4 max-h-40 overflow-y-auto">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{update.body}</p>
          </div>
        )}
        {phase === 'idle' && (
          <Button size="default" className="w-full gap-2 text-sm font-semibold shadow-lg" onClick={runUpdate}>
            <Download className="h-4 w-4" />
            Mettre à jour maintenant
          </Button>
        )}
        {phase === 'downloading' && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-xs text-muted-foreground">Téléchargement... {progress}%</p>
          </div>
        )}
        {phase === 'installing' && (
          <p className="text-center text-xs text-muted-foreground">Installation en cours, redémarrage...</p>
        )}
        {phase === 'error' && (
          <div className="space-y-2">
            <p className="text-center text-xs text-destructive">Échec de la mise à jour.</p>
            {errorMessage && (
              <p className="text-center text-[10px] text-muted-foreground break-words">{errorMessage}</p>
            )}
            <Button size="default" variant="outline" className="w-full" onClick={runUpdate}>
              Réessayer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function UpdateProgressOverlay({
  phase,
  progress,
  version,
  errorMessage,
  onRetry,
}: {
  phase: Phase;
  progress: number;
  version: string;
  closable: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-2xl mx-4">
        <p className="mb-3 text-center text-sm font-medium text-foreground">Mise à jour {version}</p>
        {phase === 'downloading' && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-xs text-muted-foreground">Téléchargement... {progress}%</p>
          </div>
        )}
        {phase === 'installing' && (
          <p className="text-center text-xs text-muted-foreground">Installation en cours, redémarrage...</p>
        )}
        {phase === 'error' && (
          <div className="space-y-2">
            <p className="text-center text-xs text-destructive">Échec de la mise à jour.</p>
            {errorMessage && (
              <p className="text-center text-[10px] text-muted-foreground break-words">{errorMessage}</p>
            )}
            {onRetry && (
              <Button size="sm" variant="outline" className="w-full" onClick={onRetry}>
                Réessayer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
