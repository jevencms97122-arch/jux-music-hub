import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { checkBackendReachable } from '@/lib/offlineMode';
import { clearLocalLibrary } from '@/lib/offlineLibrary';
import { pruneLocalOnlyListenHistory } from '@/lib/localListenHistory';
import { flushOfflinePlays, pendingOfflinePlaysCount } from '@/lib/offlinePlaySync';
import { pb } from '@/lib/pocketbase';

interface OfflineModeContextType {
  /** true une fois que l'app a basculé en mode hors connexion */
  offline: boolean;
  /** true pendant la fenêtre de resynchronisation au retour en ligne */
  isReconnecting: boolean;
}

const OfflineModeContext = createContext<OfflineModeContextType>({ offline: false, isReconnecting: false });

export function useOfflineMode() {
  return useContext(OfflineModeContext);
}

// Toute requête serveur qui dépasse ce délai est considérée comme un serveur
// endormi / une absence de connexion → bascule automatique en mode hors ligne.
const SERVER_TIMEOUT_MS = 15_000;
const RECONNECT_POLL_MS = 10_000;
const WATCHDOG_POLL_MS = 20_000;

const OFFLINE_TOAST_DESCRIPTION = "Soit le serveur est en train de dormir — vous serez averti à son réveil — soit c'est vous qui n'avez pas de connexion.";

export function OfflineModeProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectingRef = useRef(false);
  const goneOfflineOnceRef = useRef(false);

  const goOffline = () => {
    if (goneOfflineOnceRef.current) return; // déjà notifié, évite le spam
    goneOfflineOnceRef.current = true;
    setOffline(true);
    toast('Mode hors connexion activé', {
      description: OFFLINE_TOAST_DESCRIPTION,
      duration: 7000,
    });
  };

  // Au démarrage : sonde le backend. En ligne → on pousse les écoutes offline
  // en attente puis on purge les restes du mode hors connexion précédent.
  // Hors ligne (ou serveur trop lent > 15s) → bascule automatique, sans dialogue.
  useEffect(() => {
    let cancelled = false;
    checkBackendReachable(SERVER_TIMEOUT_MS).then(async (reachable) => {
      if (cancelled) return;
      if (reachable) {
        const userId = pb.authStore.model?.id;
        if (userId && pendingOfflinePlaysCount() > 0) {
          flushOfflinePlays(userId).catch(() => {});
        }
        // Purge des uploads locaux temporaires du mode hors ligne. Les sons
        // téléchargés (jux-offline-cache) et les playlists hors ligne sont
        // conservés pour la prochaine session sans connexion.
        clearLocalLibrary().catch(() => {});
        pruneLocalOnlyListenHistory();
        return;
      }
      goOffline();
    });
    return () => { cancelled = true; };
  }, []);

  // En ligne : surveille en arrière-plan que le backend répond toujours sous
  // 15s. Dès qu'une sonde échoue, bascule automatiquement hors connexion.
  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const reachable = await checkBackendReachable(SERVER_TIMEOUT_MS);
      if (cancelled || reachable) return;
      goOffline();
    }, WATCHDOG_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [offline]);

  // En mode hors connexion : surveille le retour du backend. Dès qu'il répond,
  // resynchronise (écoutes locales → serveur) et repasse en ligne sans
  // redémarrage.
  useEffect(() => {
    if (!offline) return;
    let cancelled = false;

    const tryReconnect = async () => {
      if (cancelled || reconnectingRef.current) return;
      const reachable = await checkBackendReachable(6000);
      if (cancelled || !reachable) return;

      reconnectingRef.current = true;
      setIsReconnecting(true);
      try {
        const userId = pb.authStore.model?.id;
        let synced = 0;
        if (userId) {
          synced = await flushOfflinePlays(userId).catch(() => 0);
        }
        toast.success('De retour en ligne !', {
          description: synced > 0
            ? `${synced} écoute${synced > 1 ? 's' : ''} hors ligne synchronisée${synced > 1 ? 's' : ''}.`
            : 'Ta session reprend sans interruption.',
          duration: 6000,
        });
        goneOfflineOnceRef.current = false;
        setOffline(false);
      } finally {
        reconnectingRef.current = false;
        setIsReconnecting(false);
      }
    };

    const interval = setInterval(tryReconnect, RECONNECT_POLL_MS);
    // Le navigateur signale le retour réseau plus vite que notre poll
    const onOnline = () => { tryReconnect(); };
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, [offline]);

  return (
    <OfflineModeContext.Provider value={{ offline, isReconnecting }}>
      {children}
      {isReconnecting && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] rounded-xl border border-primary/50 bg-primary/15 p-3 text-center text-sm font-semibold text-primary backdrop-blur-md">
          Reconnexion et synchronisation en cours…
        </div>
      )}
    </OfflineModeContext.Provider>
  );
}
