/**
 * Gestion des musiques téléchargées (Windows/Tauri) : liste avec taille,
 * suppression individuelle, taille totale. Combine les fichiers réels du
 * cache Tauri avec les métadonnées (titre/auteur) stockées à côté.
 */

import { listDownloadedSongs, deleteDownloadedSong, revokeDownloadedAudioBlobUrl } from './offlineCacheSync';
import { getTauriDownloadMetadataMap, removeTauriDownloadMetadata } from './offlineManager';
import { unmarkAutoDownloaded } from './autoDownloadManager';

export interface DownloadedSongInfo {
  songId: string;
  title: string;
  author: string;
  sizeBytes: number;
}

export async function listDownloadedSongsWithInfo(): Promise<DownloadedSongInfo[]> {
  const [files, metaMap] = await Promise.all([listDownloadedSongs(), getTauriDownloadMetadataMap()]);
  return files
    .map((f) => {
      const meta = metaMap.get(f.songId);
      return {
        songId: f.songId,
        title: meta?.title || 'Titre inconnu',
        author: meta?.author || '',
        sizeBytes: f.sizeBytes,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getTotalSize(songs: DownloadedSongInfo[]): number {
  return songs.reduce((sum, s) => sum + s.sizeBytes, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 2 : 1)} Mo`;
  return `${(mb / 1024).toFixed(2)} Go`;
}

export async function deleteDownloadedSongCompletely(songId: string): Promise<void> {
  await deleteDownloadedSong(songId);
  await removeTauriDownloadMetadata(songId);
  unmarkAutoDownloaded(songId);
  revokeDownloadedAudioBlobUrl(songId);
}
