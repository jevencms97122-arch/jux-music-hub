/**
 * Stockage local (IndexedDB) de la vidéo choisie par l'utilisateur pour le thème
 * personnalisé "Vidéo". IndexedDB plutôt que le système de fichiers : identique
 * sur web, Windows et Android sans code natif spécifique par plateforme.
 */

const DB_NAME = 'jux-custom-theme';
const STORE_NAME = 'video';
const DB_VERSION = 1;
const VIDEO_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Taille max acceptée pour éviter de saturer IndexedDB (mobile notamment). */
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 Mo

export async function saveCustomVideo(file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, VIDEO_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadCustomVideoBlob(): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(VIDEO_KEY);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function clearCustomVideo(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(VIDEO_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function hasCustomVideo(): Promise<boolean> {
  const blob = await loadCustomVideoBlob();
  return blob != null;
}
