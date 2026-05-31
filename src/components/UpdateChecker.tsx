import { useEffect, useState } from 'react';
import { checkForUpdate, isRunningInNativeApp } from '@/lib/versionCheck';
import UpdateModal from './UpdateModal';

type CheckState = 'spinning' | 'scanning' | 'up-to-date' | 'update-available' | 'fading-out';

export default function UpdateChecker() {
  const [state, setState] = useState<CheckState>('spinning');
  const [latestVersion, setLatestVersion] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Étape 1 : 1 seconde de spinner sans rien faire
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (cancelled) return;

      // Étape 2 : scan de la version
      setState('scanning');

      // Petite pause pour que l'utilisateur voie le spinner qui tourne
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (cancelled) return;

      // Vérifier si on est sur l'app native (PC ou Android)
      if (!isRunningInNativeApp()) {
        // Pas sur l'app native → on cache tout
        setVisible(false);
        return;
      }

      // Lancer la vérification complète avec timeout de 5 secondes
      const scanPromise = checkForUpdate();
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout' as const), 5000);
      });

      const result = await Promise.race([scanPromise, timeoutPromise]);

      if (cancelled) return;

      if (result === 'timeout') {
        // Le scan n'a rien renvoyé après 5 secondes → on ferme tout
        setVisible(false);
        return;
      }

      const { available, currentVersion, latestVersion: detectedLatest } = result;

      // Stocker la version pour la modale
      setLatestVersion(detectedLatest);

      if (currentVersion === null) {
        // Pas d'API getAppVersion dispo → version obsolète → mise à jour
        setState('update-available');

        // 1 seconde après, ouvrir la modal
        setTimeout(() => {
          if (!cancelled) {
            setModalOpen(true);
          }
        }, 1000);
        return;
      }

      if (!available) {
        setState('up-to-date');

        // Disparaître après 2 secondes
        setTimeout(() => {
          if (!cancelled) {
            setState('fading-out');
            setTimeout(() => {
              if (!cancelled) setVisible(false);
            }, 300);
          }
        }, 2000);
      } else {
        setState('update-available');

        // 1 seconde après, ouvrir la modal
        setTimeout(() => {
          if (!cancelled) {
            setModalOpen(true);
          }
        }, 1000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Si pas sur l'app native ou timeout, ne rien afficher
  if (!visible) return null;

  // Animations
  const containerAnimClass =
    state === 'fading-out'
      ? 'animate-fade-out'
      : 'animate-fade-in';

  return (
    <>
      {/* Indicateur en bas au centre */}
      <div className={`fixed bottom-28 left-1/2 z-40 -translate-x-1/2 ${containerAnimClass}`}>
        <div className="flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-md border border-border/50 px-4 py-2 shadow-elegant">
          {state === 'spinning' && (
            <>
              <svg
                className="h-4 w-4 animate-spin text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-muted-foreground">Vérification de mise à jour</span>
            </>
          )}

          {state === 'scanning' && (
            <>
              <svg
                className="h-4 w-4 animate-spin text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-muted-foreground">Scan de la version...</span>
            </>
          )}

          {state === 'up-to-date' && (
            <>
              <svg
                className="h-4 w-4 text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-xs text-green-400 font-medium">Jux-Music est à jour</span>
            </>
          )}

          {state === 'update-available' && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">
                <span className="text-xs font-extrabold text-amber-400">!</span>
              </div>
              <span className="text-xs text-amber-400 font-medium">Mise à jour disponible</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal de mise à jour */}
      <UpdateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        latestVersion={latestVersion}
      />
    </>
  );
}