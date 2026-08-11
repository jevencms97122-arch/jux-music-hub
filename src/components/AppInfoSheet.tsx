import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { updatePb } from '@/lib/updatePocketbase';
import { getDetectedPlatform } from '@/lib/versionCheck';
import { UPDATE_TRANSITION_KEY } from '@/lib/updateTransition';
import { Info, Monitor, Smartphone, Globe, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLATFORM_LABELS: Record<string, { label: string; icon: typeof Monitor }> = {
  'windows-app': { label: 'Windows', icon: Monitor },
  'android-app': { label: 'Android', icon: Smartphone },
  web: { label: 'Web', icon: Globe },
};

// Mappe la plateforme détectée vers la valeur du champ `plateforme` de app_updates
const PLATFORM_TO_UPDATE_FIELD: Record<string, string> = {
  'windows-app': 'win',
  'android-app': 'android',
};

type CheckPhase = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'installing' | 'error';

export default function AppInfoSheet({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [checkPhase, setCheckPhase] = useState<CheckPhase>('idle');
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [checkError, setCheckError] = useState<string | null>(null);

  const platformKey = getDetectedPlatform() === 'android-app' ? 'android-app' : isTauri() ? 'windows-app' : 'web';
  const platformInfo = PLATFORM_LABELS[platformKey] ?? PLATFORM_LABELS.web;

  useEffect(() => {
    if (!open) return;
    setCheckPhase('idle');
    setAvailableUpdate(null);
    setCheckError(null);
    (async () => {
      let v: string | null = null;
      if (isTauri()) {
        try { v = await getVersion(); } catch { /* noop */ }
      }
      setVersion(v);

      const field = PLATFORM_TO_UPDATE_FIELD[platformKey];
      if (!v || !field) return;
      setLoadingNotes(true);
      try {
        const record = await updatePb.collection('app_updates').getFirstListItem(
          `plateforme = "${field}" && version = "${v}"`,
          { requestKey: null }
        );
        setNotes((record as any)?.notedemiseajour || null);
      } catch {
        setNotes(null);
      } finally {
        setLoadingNotes(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCheckForUpdate = useCallback(async () => {
    if (!isTauri()) return;
    setCheckPhase('checking');
    setCheckError(null);
    try {
      const result = await check();
      if (result) {
        setAvailableUpdate(result);
        setCheckPhase('available');
      } else {
        setAvailableUpdate(null);
        setCheckPhase('up-to-date');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[AppInfoSheet] check() failed:', msg, e);
      setCheckError(msg);
      setCheckPhase('error');
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!availableUpdate) return;
    setCheckPhase('downloading');
    setProgress(0);
    setCheckError(null);
    let total = 0;
    let downloaded = 0;
    try {
      try {
        const from = await getVersion();
        localStorage.setItem(UPDATE_TRANSITION_KEY, JSON.stringify({ from, to: availableUpdate.version }));
      } catch { /* noop */ }
      await availableUpdate.downloadAndInstall((event) => {
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
            setCheckPhase('installing');
            break;
        }
      });
      await relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[AppInfoSheet] downloadAndInstall failed:', msg, e);
      setCheckError(msg);
      setCheckPhase('error');
    }
  }, [availableUpdate]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle>Informations de l'application</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card/60 p-4">
              <div className="text-[11px] font-medium text-muted-foreground">Version</div>
              <div className="mt-1 text-lg font-bold text-foreground">
                {version ? `v${version}` : '—'}
              </div>
            </div>
            <div className="rounded-2xl bg-card/60 p-4">
              <div className="text-[11px] font-medium text-muted-foreground">Plateforme</div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-bold text-foreground">
                <platformInfo.icon className="h-4 w-4 text-primary" />
                {platformInfo.label}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground">Note de mise à jour de cette version</span>
            </div>
            {loadingNotes ? (
              <div className="space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-secondary" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
              </div>
            ) : notes ? (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune note disponible pour cette version.</p>
            )}
          </div>

          {isTauri() && (
            <div className="rounded-2xl bg-card/60 p-4 space-y-3">
              {checkPhase === 'idle' && (
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleCheckForUpdate}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rechercher une mise à jour
                </Button>
              )}

              {checkPhase === 'checking' && (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Recherche en cours...
                </p>
              )}

              {checkPhase === 'up-to-date' && (
                <>
                  <p className="flex items-center justify-center gap-2 text-sm text-green-400 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    L'application est à jour
                  </p>
                  <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleCheckForUpdate}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Vérifier à nouveau
                  </Button>
                </>
              )}

              {checkPhase === 'available' && availableUpdate && (
                <>
                  <p className="text-center text-sm font-semibold text-amber-400">
                    Mise à jour {availableUpdate.version} disponible
                  </p>
                  {availableUpdate.body && (
                    <div className="rounded-xl bg-secondary/50 p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs leading-relaxed text-foreground whitespace-pre-line">{availableUpdate.body}</p>
                    </div>
                  )}
                  <Button size="sm" className="w-full gap-2" onClick={handleInstallUpdate}>
                    <Download className="h-3.5 w-3.5" />
                    Installer la mise à jour
                  </Button>
                </>
              )}

              {checkPhase === 'downloading' && (
                <div className="space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">Téléchargement... {progress}%</p>
                </div>
              )}

              {checkPhase === 'installing' && (
                <p className="text-center text-xs text-muted-foreground">Installation en cours, redémarrage...</p>
              )}

              {checkPhase === 'error' && (
                <div className="space-y-2">
                  <p className="text-center text-xs text-destructive">Échec de la vérification/mise à jour.</p>
                  {checkError && (
                    <p className="text-center text-[10px] text-muted-foreground break-words">{checkError}</p>
                  )}
                  <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleCheckForUpdate}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Réessayer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
