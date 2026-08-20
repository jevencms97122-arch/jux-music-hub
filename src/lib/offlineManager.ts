import { songAudioUrl, songCoverUrl } from './storage';
import { detectPlatform, requestNativeDownload, isSongDownloaded } from './platform';
import { isTauri, convertFileSrc } from '@tauri-apps/api/core';
import { listDownloadedSongs as listTauriDownloadedSongs, getDownloadedCoverPath } from './offlineCacheSync';
import type { Song } from '@/types/music';

const DB_NAME = 'jux-offline-cache';
// v2 : ajout des métadonnées (titre, auteur, genre, durée) dans chaque entrée
// pour pouvoir reconstruire la bibliothèque complète en mode hors connexion.
const DB_VERSION = 2;
const SONG_STORE = 'songs';

const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

interface OfflineEntry {
  songId: string;
  audioData?: ArrayBuffer;
  audioContentType?: string;
  coverData?: ArrayBuffer;
  coverContentType?: string;
  downloadedAt: number;
  // Métadonnées (v2) — permettent d'afficher et jouer le son sans backend
  title?: string;
  author?: string;
  genre?: string | null;
  duration?: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SONG_STORE)) {
        const s = db.createObjectStore(SONG_STORE, { keyPath: 'songId' });
        s.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
      // v1 → v2 : pas de changement de structure (les métadonnées sont des
      // champs optionnels sur les entrées existantes), rien à migrer.
    };
    req.onsuccess = (e) => {
      dbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(dbInstance!);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getEntry(songId: string): Promise<OfflineEntry | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SONG_STORE, 'readonly');
      const store = tx.objectStore(SONG_STORE);
      const r = store.get(songId);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function getAllEntries(): Promise<OfflineEntry[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SONG_STORE, 'readonly');
      const r = tx.objectStore(SONG_STORE).getAll();
      r.onsuccess = () => resolve((r.result ?? []) as OfflineEntry[]);
      r.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function saveEntry(entry: OfflineEntry): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SONG_STORE, 'readwrite');
      const store = tx.objectStore(SONG_STORE);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[offlineManager] saveEntry failed', e);
  }
}

async function deleteEntry(songId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readwrite');
    tx.objectStore(SONG_STORE).delete(songId);
  } catch (e) {
    console.error('[offlineManager] deleteEntry failed', e);
  }
}

async function cleanupExpired(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(SONG_STORE, 'readwrite');
    const store = tx.objectStore(SONG_STORE);
    const idx = store.index('downloadedAt');
    const cutoff = Date.now() - EXPIRY_MS;

    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          const val = cursor.value as OfflineEntry;
          if (val.downloadedAt < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        } else resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('[offlineManager] cleanup failed', e);
  }
}

async function arrayBufferFromUrl(url: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    const buffer = await r.arrayBuffer();
    return { buffer, contentType: ct };
  } catch (e) {
    return null;
  }
}

// Public API
export async function initOfflineManager(): Promise<void> {
  // open DB and run cleanup in background
  try { await openDB(); } catch {}
  cleanupExpired();
}

export async function ensureCachedForPlayback(song: any): Promise<void> {
  const platform = detectPlatform();
  // Native platforms: request native download (let native handle storage and expiry)
  if (platform !== 'web') {
    try {
      requestNativeDownload({ id: song.id, title: song.title, author: song.author || '', audioUrl: songAudioUrl(song), coverUrl: songCoverUrl(song) });
      // also store metadata locally so webview can know it's downloaded
      const entry: OfflineEntry = { songId: song.id, downloadedAt: Date.now(), title: song.title, author: song.author || '', genre: song.genre ?? null, duration: song.duration ?? 0 };
      await saveEntry(entry);
    } catch (e) {
      console.error('[offlineManager] native download request failed', e);
    }
    return;
  }

  // Web: store audio + cover in IndexedDB (non-blocking)
  try {
    const existing = await getEntry(song.id);
    if (existing && existing.audioData) return; // already

    // Download audio (don't block playback)
    arrayBufferFromUrl(songAudioUrl(song)).then(async (r) => {
      if (r && r.buffer.byteLength > 0) {
        const entry: OfflineEntry = {
          songId: song.id,
          audioData: r.buffer,
          audioContentType: r.contentType,
          downloadedAt: Date.now(),
          title: song.title,
          author: song.author || '',
          genre: song.genre ?? null,
          duration: song.duration ?? 0,
        };
        // Also try cover
        const cover = await arrayBufferFromUrl(songCoverUrl(song) || '');
        if (cover && cover.buffer.byteLength > 0) {
          entry.coverData = cover.buffer;
          entry.coverContentType = cover.contentType;
        }
        await saveEntry(entry);
        cleanupExpired();
      }
    }).catch((e) => console.error('[offlineManager] audio download failed', e));
  } catch (e) {
    console.error('[offlineManager] ensureCachedForPlayback failed', e);
  }
}

export async function getPlayableAudioUrl(song: any): Promise<string> {
  const platform = detectPlatform();
  // Native: if native reports a downloaded path, try to use it
  if (platform !== 'web') {
    try {
      // Some bridges may return a path string from isDownloaded
      const raw: any = (window as any).JuxAndroid?.isDownloaded?.(song.id) ?? (window as any).JuxDesktop?.isDownloaded?.(song.id);
      if (typeof raw === 'string' && raw.startsWith('file')) return raw;
      const nativeFlag = await isSongDownloaded(song.id);
      if (nativeFlag) {
        // Native app likely plays the local file itself; webview can still fallback to remote URL
        return songAudioUrl(song);
      }
    } catch {}
    return songAudioUrl(song);
  }

  // Web: try IndexedDB
  try {
    const entry = await getEntry(song.id);
    if (entry && entry.audioData) {
      const blob = new Blob([entry.audioData], { type: entry.audioContentType || 'audio/mpeg' });
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    /* noop */
  }
  return songAudioUrl(song);
}

export async function removeExpiredNow(): Promise<void> { return cleanupExpired(); }

export async function isSongCachedLocally(songId: string): Promise<boolean> {
  const entry = await getEntry(songId);
  if (entry && entry.audioData) return true;
  // fallback to native check
  try { return await isSongDownloaded(songId); } catch { return false; }
}

// ─── Bibliothèque hors connexion (v2) ─────────────────────────────────────────

// Cache des blob: URLs générées, pour ne pas en recréer à chaque rendu.
const blobUrlCache = new Map<string, { audio: string; cover: string | null }>();

/**
 * Reconstitue la liste des sons entièrement téléchargés (audio présent) sous
 * forme de `Song[]` directement jouables (audio_url / cover_url = blob URLs).
 * C'est la source de la bibliothèque en mode hors connexion.
 */
/**
 * Sauvegarde les métadonnées (titre, auteur, genre, durée) d'une song
 * téléchargée via le backend Tauri (fichier réel sur disque, pas de blob
 * IndexedDB). Permet de reconstruire la bibliothèque hors connexion.
 */
export async function getTauriDownloadMetadataMap(): Promise<Map<string, OfflineEntry>> {
  const entries = await getAllEntries();
  return new Map(entries.map((e) => [e.songId, e]));
}

export async function removeTauriDownloadMetadata(songId: string): Promise<void> {
  await deleteEntry(songId);
}

export async function saveTauriDownloadMetadata(song: Song): Promise<void> {
  await saveEntry({
    songId: song.id,
    downloadedAt: Date.now(),
    title: song.title,
    author: song.author || '',
    genre: song.genre ?? null,
    duration: song.duration ?? 0,
  });
}

async function getDownloadedSongsTauri(): Promise<Song[]> {
  const [files, entries] = await Promise.all([listTauriDownloadedSongs(), getAllEntries()]);
  const metaById = new Map(entries.map((e) => [e.songId, e]));
  const covers = await Promise.all(files.map((f) => getDownloadedCoverPath(f.songId)));
  const coverBySongId = new Map(files.map((f, i) => [f.songId, covers[i]]));
  return files
    .map((f) => {
      const meta = metaById.get(f.songId);
      return {
        id: f.songId,
        title: meta?.title || 'Titre inconnu',
        author: meta?.author || '',
        audio_url: convertFileSrc(f.localPath),
        cover_url: coverBySongId.get(f.songId) ?? null,
        video_url: null,
        genre: meta?.genre ?? null,
        uploaded_by: '',
        duration: meta?.duration ?? 0,
        play_count: 0,
        likes_count: 0,
        created_at: meta ? new Date(meta.downloadedAt).toISOString() : new Date().toISOString(),
        updated_at: meta ? new Date(meta.downloadedAt).toISOString() : new Date().toISOString(),
      } as Song;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDownloadedSongs(): Promise<Song[]> {
  if (isTauri()) return getDownloadedSongsTauri();

  const entries = await getAllEntries();
  return entries
    .filter((e) => e.audioData && e.title)
    .sort((a, b) => b.downloadedAt - a.downloadedAt)
    .map((e) => {
      let urls = blobUrlCache.get(e.songId);
      if (!urls) {
        urls = {
          audio: URL.createObjectURL(new Blob([e.audioData!], { type: e.audioContentType || 'audio/mpeg' })),
          cover: e.coverData ? URL.createObjectURL(new Blob([e.coverData], { type: e.coverContentType || 'image/jpeg' })) : null,
        };
        blobUrlCache.set(e.songId, urls);
      }
      return {
        id: e.songId,
        title: e.title!,
        author: e.author || '',
        audio_url: urls.audio,
        cover_url: urls.cover,
        video_url: null,
        genre: e.genre ?? null,
        uploaded_by: '',
        duration: e.duration ?? 0,
        play_count: 0,
        likes_count: 0,
        created_at: new Date(e.downloadedAt).toISOString(),
        updated_at: new Date(e.downloadedAt).toISOString(),
      } as Song;
    });
}

export async function getDownloadedSongIds(): Promise<Set<string>> {
  const entries = await getAllEntries();
  return new Set(entries.filter((e) => e.audioData).map((e) => e.songId));
}

export async function deleteDownloadedSong(songId: string): Promise<void> {
  const cached = blobUrlCache.get(songId);
  if (cached) {
    URL.revokeObjectURL(cached.audio);
    if (cached.cover) URL.revokeObjectURL(cached.cover);
    blobUrlCache.delete(songId);
  }
  await deleteEntry(songId);
}

// ─── File de téléchargement (max 3 en parallèle) ──────────────────────────────

const downloadQueue: Song[] = [];
const queuedIds = new Set<string>();
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3;

async function pumpDownloadQueue(): Promise<void> {
  while (activeDownloads < MAX_CONCURRENT_DOWNLOADS && downloadQueue.length > 0) {
    const song = downloadQueue.shift()!;
    activeDownloads++;
    (async () => {
      try {
        await ensureCachedForPlayback(song);
      } finally {
        queuedIds.delete(song.id);
        activeDownloads--;
        pumpDownloadQueue();
      }
    })();
  }
}

/**
 * Met des sons en file de téléchargement pour l'écoute hors connexion.
 * Ignore silencieusement ceux déjà téléchargés ou déjà en file.
 */
export async function queueSongsForOffline(songs: Song[]): Promise<void> {
  const already = await getDownloadedSongIds();
  for (const song of songs) {
    if (!song?.id || song.id.startsWith('local_')) continue;
    if (already.has(song.id) || queuedIds.has(song.id)) continue;
    queuedIds.add(song.id);
    downloadQueue.push(song);
  }
  pumpDownloadQueue();
}
