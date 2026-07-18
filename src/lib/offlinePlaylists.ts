const DB_NAME = 'jux_offline_playlists';
const DB_VERSION = 1;
const STORE_NAME = 'playlists';

export interface LocalPlaylist {
  id: string;
  title: string;
  trackIds: string[];
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function generateLocalPlaylistId(): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `localpl_${uuid}`;
}

async function putPlaylist(record: LocalPlaylist): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createLocalPlaylist(title: string): Promise<LocalPlaylist> {
  const record: LocalPlaylist = {
    id: generateLocalPlaylistId(),
    title,
    trackIds: [],
    createdAt: new Date().toISOString(),
  };
  await putPlaylist(record);
  return record;
}

export async function getLocalPlaylists(): Promise<LocalPlaylist[]> {
  const db = await openDb();
  const records = await new Promise<LocalPlaylist[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as LocalPlaylist[]);
    req.onerror = () => reject(req.error);
  });
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLocalPlaylist(id: string): Promise<LocalPlaylist | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as LocalPlaylist) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Vide toutes les playlists locales (créées en mode hors ligne).
 * Appelé à la resynchronisation en ligne pour libérer le stockage de l'appareil.
 */
export async function clearLocalPlaylists(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLocalPlaylist(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addTrackToLocalPlaylist(playlistId: string, trackId: string): Promise<LocalPlaylist | null> {
  const playlist = await getLocalPlaylist(playlistId);
  if (!playlist) return null;
  if (!playlist.trackIds.includes(trackId)) {
    playlist.trackIds = [...playlist.trackIds, trackId];
    await putPlaylist(playlist);
  }
  return playlist;
}

export async function removeTrackFromLocalPlaylist(playlistId: string, trackId: string): Promise<LocalPlaylist | null> {
  const playlist = await getLocalPlaylist(playlistId);
  if (!playlist) return null;
  playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
  await putPlaylist(playlist);
  return playlist;
}
