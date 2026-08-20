/**
 * Gestionnaire de téléchargement automatique de musique
 * (Windows seulement pour l'instant)
 *
 * Fonction :
 * 1. Tracker les songs téléchargées automatiquement depuis la dernière maj
 * 2. Activer/désactiver les téléchargements auto via un paramètre
 * 3. Notifier l'app quand un téléchargement est en cours
 */

import { isWindowsPlatform, type NativePlatform, detectPlatform, requestNativeDownload, type DownloadPayload, onDownloadProgress, type DownloadProgressEvent } from './platform';
import { getNativePreferences, setNativePreference, isNativeAppSettingsAvailable } from './nativeSettings';
import { saveTauriDownloadMetadata } from './offlineManager';
import type { Song } from '@/types/music';
import { invoke, isTauri } from '@tauri-apps/api/core';

const AUTO_DOWNLOAD_KEY = 'auto_download_enabled';
const AUTO_DOWNLOADED_SONGS_KEY = 'auto_downloaded_songs'; // localStorage key for tracking
const AUTO_DOWNLOAD_LOCAL_KEY = 'jux_auto_download_enabled'; // fallback localStorage (pas de bridge natif sous Tauri)

function getLocalAutoDownloadPref(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_DOWNLOAD_LOCAL_KEY);
    if (stored === null) return true; // activé par défaut
    return stored === 'true';
  } catch {
    return true;
  }
}

function setLocalAutoDownloadPref(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_DOWNLOAD_LOCAL_KEY, String(enabled));
  } catch {
    console.error('[autoDownloadManager] Failed to persist auto-download preference');
  }
}

interface DownloadNotification {
  songId: string;
  title: string;
  author: string;
  status: 'downloading' | 'done' | 'error';
  progress: number;
  error?: string;
}

type DownloadListener = (notification: DownloadNotification) => void;
const downloadListeners = new Set<DownloadListener>();

export function onAutoDownloadProgress(cb: DownloadListener): () => void {
  downloadListeners.add(cb);
  return () => downloadListeners.delete(cb);
}

function emitDownloadProgress(notification: DownloadNotification) {
  downloadListeners.forEach((cb) => {
    try { cb(notification); } catch (err) { console.error(err); }
  });
}

export async function isAutoDownloadEnabled(platform: NativePlatform | null): Promise<boolean> {
  // Fonctionnalité Windows seulement pour l'instant
  if (!isWindowsPlatform(platform)) return false;

  if (isNativeAppSettingsAvailable()) {
    const prefs = await getNativePreferences();
    if (!prefs) return true; // Default enabled
    const val = prefs[AUTO_DOWNLOAD_KEY];
    if (val === null || val === undefined) return true;
    if (typeof val === 'object' && 'value' in val) {
      return (val as any).value !== false;
    }
    return val !== false;
  }
  // Pas de bridge natif (cas Tauri) : le réglage est persisté en localStorage
  return getLocalAutoDownloadPref();
}

export async function setAutoDownloadEnabled(enabled: boolean): Promise<void> {
  const persistedNatively = await setNativePreference(AUTO_DOWNLOAD_KEY, enabled);
  if (!persistedNatively) {
    setLocalAutoDownloadPref(enabled);
  }
}

/** Tracker les songs qui ont été téléchargées automatiquement */
function getAutoDownloadedSongs(): Set<string> {
  try {
    const stored = localStorage.getItem(AUTO_DOWNLOADED_SONGS_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function setAutoDownloadedSongs(songs: Set<string>): void {
  try {
    localStorage.setItem(AUTO_DOWNLOADED_SONGS_KEY, JSON.stringify(Array.from(songs)));
  } catch {
    console.error('[autoDownloadManager] Failed to save downloaded songs');
  }
}

export function isAutoDownloadedBefore(songId: string): boolean {
  return getAutoDownloadedSongs().has(songId);
}

function markAsAutoDownloaded(songId: string): void {
  const songs = getAutoDownloadedSongs();
  songs.add(songId);
  setAutoDownloadedSongs(songs);
}

/** Retire une song du suivi "déjà téléchargée" (ex: après suppression manuelle) */
export function unmarkAutoDownloaded(songId: string): void {
  const songs = getAutoDownloadedSongs();
  songs.delete(songId);
  setAutoDownloadedSongs(songs);
}

/**
 * Déclenche le téléchargement automatique d'une song
 * Doit être appelée quand une song commence à être jouée pour la 1ère fois
 */
export async function triggerAutoDownload(
  song: Song,
  platform: NativePlatform | null,
  isOnline: boolean,
  songAudioUrl: (song: Song) => string,
  songCoverUrl: (song: Song) => string
): Promise<void> {
  // Ne télécharger que si on est en ligne et que c'est Windows
  if (!isOnline || !isWindowsPlatform(platform)) return;

  // Sons externes (lecture YouTube) ou déjà locaux : rien de distant à télécharger
  if (song.id.startsWith('external:') || song.id.startsWith('local_')) return;

  // Ne télécharger que si c'est la première fois depuis la maj
  if (isAutoDownloadedBefore(song.id)) return;

  // Vérifier si l'auto-download est activé
  const enabled = await isAutoDownloadEnabled(platform);
  if (!enabled) return;

  // Pas d'URL distante exploitable (source vide/locale) : rien à télécharger
  const resolvedAudioUrl = songAudioUrl(song);
  if (!resolvedAudioUrl || !resolvedAudioUrl.startsWith('http')) return;

  // Marquer comme auto-downloadé avant même de commencer
  markAsAutoDownloaded(song.id);

  // Marquer comme en cours de téléchargement et émettre la notif
  emitDownloadProgress({
    songId: song.id,
    title: song.title || 'Unknown',
    author: song.author || 'Unknown',
    status: 'downloading',
    progress: 0,
  });

  try {
    // Utiliser Tauri pour le téléchargement si disponible
    if (isTauri()) {
      await invoke('download_song', {
        songId: song.id,
        title: song.title || 'Unknown',
        author: song.author || 'Unknown',
        audioUrl: resolvedAudioUrl,
        coverUrl: songCoverUrl(song),
      });

      await saveTauriDownloadMetadata(song);

      emitDownloadProgress({
        songId: song.id,
        title: song.title || 'Unknown',
        author: song.author || 'Unknown',
        status: 'done',
        progress: 100,
      });
    } else {
      // Fallback sur le bridge natif si Tauri n'est pas disponible
      const payload: DownloadPayload = {
        id: song.id,
        title: song.title || 'Unknown',
        author: song.author || 'Unknown',
        audioUrl: resolvedAudioUrl,
        coverUrl: songCoverUrl(song),
      };

      const requested = requestNativeDownload(payload);
      if (!requested) {
        throw new Error('Native download not available');
      }
    }
  } catch (err) {
    console.error('[autoDownloadManager] Download failed', err);
    // Retire le marquage pour permettre une nouvelle tentative à la prochaine écoute
    unmarkAutoDownloaded(song.id);
    emitDownloadProgress({
      songId: song.id,
      title: song.title || 'Unknown',
      author: song.author || 'Unknown',
      status: 'error',
      progress: 0,
      error: err instanceof Error ? err.message : 'Download failed',
    });
  }
}

/**
 * Initialiser le bus d'événements de téléchargement natif
 * Convertir les événements natifs en notifications d'app
 */
export function initAutoDownloadEvents(): void {
  // Écouter les événements de progression du téléchargement natif
  const unsubscribe = onDownloadProgress((event: DownloadProgressEvent) => {
    // Convertir en notification d'app
    emitDownloadProgress({
      songId: event.songId,
      title: '', // On n'a pas le titre ici, le listener devra le chercher
      author: '',
      status: event.status === 'done' ? 'done' : event.status === 'downloading' ? 'downloading' : 'error',
      progress: event.progress,
      error: event.error,
    });
  });

  return () => unsubscribe();
}
