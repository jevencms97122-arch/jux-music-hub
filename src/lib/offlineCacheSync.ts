/**
 * Synchronise les fichiers téléchargés du cache Tauri avec la base offline (IndexedDB)
 * Permet de jouer les musiques téléchargées en mode hors ligne
 */

import { isTauri, invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface CachedAudioFile {
  songId: string;
  localPath: string;
  sizeBytes: number;
}

/**
 * Récupère l'URL locale (file://) pour un fichier audio téléchargé
 */
export async function getDownloadedAudioPath(songId: string): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    const path = await invoke<string>('get_downloaded_audio_path', { songId });
    if (!path) return null;

    // Convertir le chemin Rust en URL accessible au navigateur
    return convertFileSrc(path);
  } catch (err) {
    console.error('[offlineCacheSync] Failed to get audio path', err);
    return null;
  }
}

function guessAudioMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'm4a': return 'audio/mp4';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'opus': return 'audio/opus';
    default: return 'audio/mpeg';
  }
}

// blob: URLs déjà générées, pour ne pas relire le fichier à chaque lecture.
const audioBlobUrlCache = new Map<string, string>();

/**
 * Reconstruit une URL `blob:` jouable pour un fichier audio téléchargé, en le
 * lisant intégralement via Rust (voir `read_downloaded_audio` dans lib.rs).
 *
 * Utilisé UNIQUEMENT sur Android : le protocole `asset://` de Tauri (via
 * `convertFileSrc`, voir `getDownloadedAudioPath` ci-dessus) coupe la lecture
 * en cours de route sur Android — la WebView système ne gère pas fiablement
 * ce protocole pour de l'audio local (durée mal détectée, lecture tronquée
 * après quelques dizaines de secondes). Sur Windows (WebView2), `convertFileSrc`
 * fonctionne très bien et reste utilisé tel quel.
 */
export async function getDownloadedAudioBlobUrl(songId: string): Promise<string | null> {
  if (!isTauri()) return null;

  const cached = audioBlobUrlCache.get(songId);
  if (cached) return cached;

  try {
    const rawPath = await invoke<string>('get_downloaded_audio_path', { songId });
    if (!rawPath) return null;
    const bytes = await invoke<ArrayBuffer>('read_downloaded_audio', { songId });
    const blob = new Blob([bytes], { type: guessAudioMime(rawPath) });
    const url = URL.createObjectURL(blob);
    audioBlobUrlCache.set(songId, url);
    return url;
  } catch (err) {
    console.error('[offlineCacheSync] Failed to read downloaded audio', err);
    return null;
  }
}

/** Libère l'URL blob mise en cache pour ce morceau (suppression du téléchargement). */
export function revokeDownloadedAudioBlobUrl(songId: string): void {
  const url = audioBlobUrlCache.get(songId);
  if (url) {
    URL.revokeObjectURL(url);
    audioBlobUrlCache.delete(songId);
  }
}

/**
 * Récupère l'URL locale (file://) pour la cover d'une musique téléchargée
 */
export async function getDownloadedCoverPath(songId: string): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    const path = await invoke<string>('get_downloaded_cover_path', { songId });
    if (!path) return null;
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

/**
 * Liste tous les fichiers audio téléchargés
 */
export async function listDownloadedSongs(): Promise<CachedAudioFile[]> {
  if (!isTauri()) return [];

  try {
    const songs = await invoke<CachedAudioFile[]>('list_downloaded_songs');
    return songs || [];
  } catch (err) {
    console.error('[offlineCacheSync] Failed to list downloaded songs', err);
    return [];
  }
}

/**
 * Supprime un fichier audio téléchargé
 */
export async function deleteDownloadedSong(songId: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    await invoke('delete_downloaded_song', { songId });
    return true;
  } catch (err) {
    console.error('[offlineCacheSync] Failed to delete song', err);
    return false;
  }
}
