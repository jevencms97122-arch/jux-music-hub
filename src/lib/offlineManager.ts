import { songAudioUrl, songCoverUrl } from './storage';
import { detectPlatform, requestNativeDownload, isSongDownloaded } from './platform';

const DB_NAME = 'jux-offline-cache';
const DB_VERSION = 1;
const SONG_STORE = 'songs';

const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

interface OfflineEntry {
  songId: string;
  audioData?: ArrayBuffer;
  audioContentType?: string;
  coverData?: ArrayBuffer;
  coverContentType?: string;
  downloadedAt: number;
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
      const entry: OfflineEntry = { songId: song.id, downloadedAt: Date.now() };
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
