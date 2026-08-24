/**
 * Pont Android pour la lecture musicale (Now Playing + Notifications)
 * 
 * Ce module permet à l'app Android native de :
 * - Connaître la musique en cours (titre, auteur, cover, durée, état)
 * - Recevoir les commandes utilisateur depuis la notification Android (play, pause, next, prev)
 * - Afficher une notification personnalisée avec cover et contrôles
 */

export interface NowPlayingInfo {
  /** ID unique de la chanson (ou "external:VIDEO_ID" pour YouTube) */
  songId: string;
  /** Titre de la chanson */
  title: string;
  /** Nom de l'artiste/auteur */
  author: string;
  /** URL complète de la cover (absolue) */
  coverUrl: string;
  /** Durée en secondes */
  duration: number;
  /** Position actuelle en secondes */
  currentTime: number;
  /** État de lecture */
  isPlaying: boolean;
  /** Taux de lecture (1 = normal) */
  playbackRate: number;
  /** Volume (0-1) */
  volume: number;
  /** Mode de répétition */
  repeatMode: 'off' | 'all' | 'one';
  /** Aléatoire activé ? */
  isShuffled: boolean;
}

export type NativeCommand =
  | 'play'
  | 'pause'
  | 'togglePlay'
  | 'next'
  | 'previous'
  | 'prev'
  | 'play_pause'
  | 'seek'
  | 'stop';

export interface NativeCommandEvent {
  command: NativeCommand;
  /** Utilisé uniquement pour la commande 'seek' (position en secondes) */
  seekTime?: number;
}

// ── Bridge Windows (SMTC natif — voir src-tauri/src/lib.rs) ──────────────────
// Contrairement à Android (WebView contrôlée nous-mêmes), l'intégration
// automatique du navigateur avec les contrôles média système Windows affiche
// "Application inconnue" pour une app non empaquetée. On désactive cette
// intégration auto (additionalBrowserArgs) et on pilote nous-mêmes un vrai
// SystemMediaTransportControls WinRT depuis Rust.
let smtcBridgeInitialized = false;

// sendNowPlayingToNative est appelé à chaque tick de lecture (chaque seconde) pour
// mettre à jour currentTime — sans ce filtre, on redéfinissait la pochette en boucle
// et Windows la re-affichait à chaque fois, causant un flicker visible dans le popup.
let lastSmtcSignature = '';

async function updateWindowsNowPlaying(info: NowPlayingInfo): Promise<void> {
  const signature = `${info.title}|${info.author}|${info.coverUrl}|${info.isPlaying}`;
  if (signature === lastSmtcSignature) return;
  lastSmtcSignature = signature;

  try {
    const { isTauri, invoke } = await import('@tauri-apps/api/core');
    if (!isTauri()) return;
    await invoke('smtc_update', { title: info.title, artist: info.author, isPlaying: info.isPlaying, coverUrl: info.coverUrl || null });
  } catch {
    // noop
  }
}

async function clearWindowsNowPlaying(): Promise<void> {
  lastSmtcSignature = '';
  try {
    const { isTauri, invoke } = await import('@tauri-apps/api/core');
    if (!isTauri()) return;
    await invoke('smtc_clear');
  } catch {
    // noop
  }
}

/** Écoute les boutons du popup média Windows (play/pause/next/previous) et les
 * relaie vers le même canal que les commandes Android (window.onJuxNativeCommand). */
async function initSmtcBridgeOnce(): Promise<void> {
  if (smtcBridgeInitialized) return;
  smtcBridgeInitialized = true;
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return;
    const { listen } = await import('@tauri-apps/api/event');
    await listen<string>('smtc-command', (event) => {
      window.onJuxNativeCommand?.(JSON.stringify({ command: event.payload }));
    });
  } catch {
    // noop
  }
}

// ── Types pour le bridge natif ──────────────────────────────────

declare global {
  interface Window {
    /** Fonction appelée par le code natif Android pour transmettre une commande utilisateur */
    onJuxNativeCommand?: (json: string) => void;
  }
}

/**
 * Envoie les informations de la musique en cours au code natif Android.
 * L'app native pourra alors mettre à jour la notification système.
 */
export function sendNowPlayingToNative(info: NowPlayingInfo): void {
  if (typeof window === 'undefined') return;

  void updateWindowsNowPlaying(info);

  try {
    // Méthode 1 : Pont JuxAndroid avec une méthode dédiée (recommandé)
    if (window.JuxAndroid && typeof (window.JuxAndroid as any).updateNowPlaying === 'function') {
      (window.JuxAndroid as any).updateNowPlaying(JSON.stringify(info));
      return;
    }

    // Méthode 2 : Stocker dans une variable globale pour que le natif puisse la lire
    (window as any).__juxNowPlaying = info;

    // Méthode 3 : Envoyer un événement personnalisé que le natif peut intercepter
    try {
      const event = new CustomEvent('jux:nowPlaying', { detail: info });
      window.dispatchEvent(event);
    } catch {
      // Ignorer si les CustomEvent ne sont pas supportés
    }
  } catch (e) {
    console.error('[androidMediaBridge] sendNowPlayingToNative failed', e);
  }
}

/**
 * Met à jour uniquement la position/état de lecture côté natif (Android), sans
 * reconstruire la notification système. À appeler à fréquence réduite (~1x/sec) —
 * contrairement à sendNowPlayingToNative qui déclenche un rebuild complet de la
 * notification (image, MediaSession, actions...) et ne doit être appelée qu'au
 * changement réel de morceau/état, jamais sur chaque tick de `currentTime`.
 */
export function sendPlaybackPositionToNative(currentTime: number, isPlaying: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.JuxAndroid && typeof (window.JuxAndroid as any).updatePosition === 'function') {
      (window.JuxAndroid as any).updatePosition(currentTime, isPlaying);
    }
  } catch (e) {
    console.error('[androidMediaBridge] sendPlaybackPositionToNative failed', e);
  }
}

/**
 * Informe le code natif que la lecture s'est arrêtée (plus de musique en cours).
 */
export function clearNowPlayingOnNative(): void {
  if (typeof window === 'undefined') return;

  void clearWindowsNowPlaying();

  try {
    if (window.JuxAndroid && typeof (window.JuxAndroid as any).clearNowPlaying === 'function') {
      (window.JuxAndroid as any).clearNowPlaying();
      return;
    }

    (window as any).__juxNowPlaying = null;

    try {
      const event = new CustomEvent('jux:clearNowPlaying');
      window.dispatchEvent(event);
    } catch {
      // Ignorer
    }
  } catch (e) {
    console.error('[androidMediaBridge] clearNowPlayingOnNative failed', e);
  }
}

/**
 * Enregistre un écouteur pour les commandes venant du code natif Android.
 * Retourne une fonction pour se désabonner.
 */
export function onNativeCommand(callback: (event: NativeCommandEvent) => void): () => void {
  void initSmtcBridgeOnce();

  const handler = (json: string) => {
    try {
      const cmd: NativeCommandEvent = JSON.parse(json);
      callback(cmd);
    } catch (e) {
      console.error('[androidMediaBridge] Invalid native command', e);
    }
  };

  // Expose la fonction globalement pour que le natif puisse l'appeler
  window.onJuxNativeCommand = handler;

  // Retourne une fonction de nettoyage
  return () => {
    if (window.onJuxNativeCommand === handler) {
      delete window.onJuxNativeCommand;
    }
  };
}

/**
 * Convertit l'URL de cover (relative/absolue) en URL absolue.
 * Nécessaire car le code natif reçoit l'URL relative depuis songCoverUrl().
 */
export function resolveCoverUrl(coverUrl: string): string {
  if (!coverUrl) return '';
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }
  // Convertir les chemins relatifs en URL absolue
  try {
    return new URL(coverUrl, window.location.origin).href;
  } catch {
    return coverUrl;
  }
}