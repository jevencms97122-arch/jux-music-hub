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
 * Informe le code natif que la lecture s'est arrêtée (plus de musique en cours).
 */
export function clearNowPlayingOnNative(): void {
  if (typeof window === 'undefined') return;

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