import React, { createContext, useContext, useEffect, useState } from 'react';
import { checkBackendReachable, quitApp } from '@/lib/offlineMode';
import { clearLocalLibrary } from '@/lib/offlineLibrary';
import { clearLocalPlaylists } from '@/lib/offlinePlaylists';
import { pruneLocalOnlyListenHistory } from '@/lib/localListenHistory';

interface OfflineModeContextType {
  /** true une fois que le joueur a accepté le mode hors connexion */
  offline: boolean;
}

const OfflineModeContext = createContext<OfflineModeContextType>({ offline: false });

export function useOfflineMode() {
  return useContext(OfflineModeContext);
}

export function OfflineModeProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkBackendReachable(10000).then((reachable) => {
      if (cancelled) return;
      if (reachable) {
        // Resynchronisation en ligne : on purge tout le stockage hors ligne
        // (sons uploadés localement, playlists locales, historique local_…)
        // pour libérer l'espace de l'appareil, comme si on n'y était jamais allé.
        clearLocalLibrary().catch(() => {});
        clearLocalPlaylists().catch(() => {});
        pruneLocalOnlyListenHistory();
        return;
      }
      setShowDialog(true);
    });
    return () => { cancelled = true; };
  }, []);

  const handleYes = () => {
    setOffline(true);
    setShowDialog(false);
  };

  const handleNo = () => {
    quitApp();
  };

  return (
    <OfflineModeContext.Provider value={{ offline }}>
      {children}
      {showDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background p-6 text-center shadow-elegant">
            <p className="mb-5 text-sm font-medium text-foreground">
              Le serveur n'est peut-être pas accessible. Passer en mode hors connexion ?
            </p>
            <p className="mb-5 text-xs text-muted-foreground">
              En mode hors connexion, seuls les sons que tu as ajoutés toi-même seront disponibles et le mode social sera désactivé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleNo}
                className="flex-1 rounded-xl border border-border/60 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary"
              >
                Non
              </button>
              <button
                onClick={handleYes}
                className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Oui
              </button>
            </div>
          </div>
        </div>
      )}
    </OfflineModeContext.Provider>
  );
}
