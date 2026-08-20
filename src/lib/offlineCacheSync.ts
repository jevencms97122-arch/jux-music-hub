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
