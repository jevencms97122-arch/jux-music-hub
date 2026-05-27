/**
 * Détection de la plateforme d'exécution de Jux + bridge natif
 * pour les téléchargements hors connexion (Android / Windows).
 */

export type JuxPlatform = 'android-app' | 'windows-app' | 'web';

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

export interface DownloadProgressEvent {
  songId: string;
  status: DownloadStatus;
  /** 0 → 100 */
  progress: number;
  error?: string;
}

declare global {
  interface Window {
    /** Bridge natif Android (legacy, sans les téléchargements) */
    Android?: {
      getAppPreferences?: () => string;
      setAppPreference?: (key: string, value: unknown) => void;
    };
    JuxAndroid?: {
      downloadSong: (payload: string) => void;
      isAvailable?: () => boolean;
      isDownloaded?: (songId: string) => boolean | string;
      deleteDownload?: (songId: string) => boolean | string;
      listDownloads?: () => string;
      getAppPreferences?: () => string;
      setAppPreference?: (key: string, value: unknown) => void;
    };
    JuxDesktop?: {
      downloadSong: (payload: unknown) => void | Promise<void>;
      isDownloaded?: (songId: string) => boolean | Promise<boolean>;
      deleteDownload?: (songId: string) => boolean | Promise<boolean>;
      listDownloads?: () => string[] | Promise<string[]>;
      onDownloadProgress?: (cb: (e: DownloadProgressEvent) => void) => void;
      platform?: string;
      /** Retourne la version de l'app PC (ex: "1.0.1") */
      getAppVersion?: () => string | Promise<string>;
      getAppPreferences?: () => string | Promise<string>;
      setAppPreference?: (key: string, value: unknown) => void | Promise<void>;
    };
    /** Version de l'app PC exposée par le bridge natif (fallback synchrone) */
    __JUX_APP_VERSION?: string;
    /** Fonction utilitaire exposée par le bridge natif */
    getJuxAppVersion?: () => string | Promise<string>;
    /** Le bridge natif appelle cette fonction pour notifier la WebView */
    juxOnDownloadProgress?: (e: DownloadProgressEvent) => void;
  }
}

export function detectPlatform(): JuxPlatform {
  if (typeof window === 'undefined') return 'web';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (window.JuxAndroid || ua.includes('jux_music') || ua.includes('com.example.jux_music')) return 'android-app';
  if (window.JuxDesktop || ua.includes('jux-music-pc-app') || ua.includes('electron')) return 'windows-app';
  return 'web';
}

export interface DownloadPayload {
  id: string;
  title: string;
  author: string;
  audioUrl: string;
  coverUrl: string;
}

export function requestNativeDownload(payload: DownloadPayload): boolean {
  try {
    if (window.JuxAndroid?.downloadSong) {
      window.JuxAndroid.downloadSong(JSON.stringify(payload));
      return true;
    }
    if (window.JuxDesktop?.downloadSong) {
      window.JuxDesktop.downloadSong(payload);
      return true;
    }
  } catch (e) {
    console.error('Native download failed', e);
  }
  return false;
}

export async function isSongDownloaded(songId: string): Promise<boolean> {
  try {
    if (window.JuxAndroid?.isDownloaded) {
      const r = window.JuxAndroid.isDownloaded(songId);
      return typeof r === 'string' ? r === 'true' : !!r;
    }
    if (window.JuxDesktop?.isDownloaded) {
      return !!(await window.JuxDesktop.isDownloaded(songId));
    }
  } catch (e) {
    console.error('isSongDownloaded failed', e);
  }
  return false;
}

export async function deleteDownloadedSong(songId: string): Promise<boolean> {
  try {
    if (window.JuxAndroid?.deleteDownload) {
      const r = window.JuxAndroid.deleteDownload(songId);
      return typeof r === 'string' ? r === 'true' : !!r;
    }
    if (window.JuxDesktop?.deleteDownload) {
      return !!(await window.JuxDesktop.deleteDownload(songId));
    }
  } catch (e) {
    console.error('deleteDownloadedSong failed', e);
  }
  return false;
}

/* ── Bus d'événements de progression ─────────────────────────── */

type Listener = (e: DownloadProgressEvent) => void;
const listeners = new Set<Listener>();

export function onDownloadProgress(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(e: DownloadProgressEvent) {
  listeners.forEach((l) => {
    try { l(e); } catch (err) { console.error(err); }
  });
}

if (typeof window !== 'undefined') {
  // Bridge natif → JS : Android/Windows appelle cette fonction
  window.juxOnDownloadProgress = (e: DownloadProgressEvent) => emit(e);

  // Si l'app desktop expose un canal dédié, on s'y abonne aussi
  try {
    window.JuxDesktop?.onDownloadProgress?.((e) => emit(e));
  } catch { /* noop */ }
}
