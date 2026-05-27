import { useEffect, useState, useRef } from 'react';
import { isRunningInDesktopApp, getDesktopAppVersion, LATEST_DESKTOP_VERSION } from '@/lib/versionCheck';
import UpdateModal from './UpdateModal';

type CheckState = 'spinning' | 'scanning' | 'up-to-date' | 'update-available' | 'fading-out';

export default function UpdateChecker() {
  const [state, setState] = useState<CheckState>('spinning');
  const [latestVersion] = useState(LATEST_DESKTOP_VERSION);
  const [modalOpen, setModalOpen] = useState(false);
  const visibleRef = useRef(true);
  const modalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Nettoie tous les timers
    const clearAllTimers = () => {
      if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };

    (async () => {
      // Étape 1 : 1 seconde de spinner sans rien faire
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (cancelled) return;

      // Étape 2 : scan de la version
      setState('scanning');

      // Petite pause pour que l'utilisateur voie le spinner qui tourne
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (cancelled) return;

      // Vérifier si on est sur l'app PC
      const isDesktop = isRunningInDesktopApp();
      if (!isDesktop) {
        setState('up-to-date');
        return;
      }

      // Lancer le scan avec un timeout de 5 secondes max
      // On utilise Promise.race pour que le premier qui arrive gagne
      const scanResult = await Promise.race([
        getDesktopAppVersion(),
        new Promise<'timeout'>((resolve) => {
          const id = setTimeout(() => resolve('timeout' as const), 5000);
          // On stocke le ref pour cleanup
          modalTimerRef.current = id;
        }),
      ]);

      if (cancelled) return;

      if (scanResult === 'timeout') {
        // Le scan a pris plus de 5 secondes → on force la mise à jour
        setState('update-available');

        // 1 seconde après, ouvrir la modal
        modalTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setModalOpen(true);
          }
        }, 1000);
        return;
      }

      // Le scan a répondu avant 5 secondes
      const currentVersion = scanResult as string | null;

      if (currentVersion === null) {
        // Pas sur l'app PC → on cache tout
        visibleRef.current = false;
        return;
      }

      if (currentVersion === LATEST_DESKTOP_VERSION) {
        setState('up-to-date');

        // Disparaître après 2 secondes
        fadeTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setState('fading-out');
            setTimeout(() => {
              if (!cancelled) visibleRef.current = false;
            }, 300);
          }
        }, 2000);
      } else {
        setState('update-available');

        // 1 seconde après, ouvrir la modal
        modalTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setModalOpen(true);
          }
        }, 1000);
      }
    })();

    return () => {
      cancelled = true;
      clearAllTimers();
    };
  }, []);

  // Si pas sur l'app PC, ne rien afficher
  if (!visibleRef.current) return null;

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