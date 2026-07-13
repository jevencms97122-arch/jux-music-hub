import type { Song } from '@/types/music';

const DB_NAME = 'jux_offline_library';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

interface LocalTrackRecord {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  duration: number;
  createdAt: string;
  audioBlob: Blob;
  coverBlob: Blob | null;
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

function generateLocalId(): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `local_${uuid}`;
}

// Cache des blob: URL créées, pour ne pas en régénérer à chaque rendu.
const blobUrlCache = new Map<string, { audio: string; cover: string | null }>();

function toSong(record: LocalTrackRecord): Song {
  let urls = blobUrlCache.get(record.id);
  if (!urls) {
    urls = {
      audio: URL.createObjectURL(record.audioBlob),
      cover: record.coverBlob ? URL.createObjectURL(record.coverBlob) : null,
    };
    blobUrlCache.set(record.id, urls);
  }
  return {
    id: record.id,
    title: record.title,
    author: record.author,
    audio_url: urls.audio,
    cover_url: urls.cover,
    video_url: null,
    genre: record.genre,
    uploaded_by: 'local',
    duration: record.duration,
    play_count: 0,
    likes_count: 0,
    created_at: record.createdAt,
    updated_at: record.createdAt,
    is_local: true,
  };
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener('loadedmetadata', () => { resolve(audio.duration || 0); cleanup(); }, { once: true });
    audio.addEventListener('error', () => { resolve(0); cleanup(); }, { once: true });
  });
}

export async function addLocalTrack(params: {
  title: string;
  author: string;
  genre?: string | null;
  audioFile: File;
  coverFile?: File | null;
}): Promise<Song> {
  const duration = await getAudioDuration(params.audioFile);
  const record: LocalTrackRecord = {
    id: generateLocalId(),
    title: params.title,
    author: params.author,
    genre: params.genre || null,
    duration,
    createdAt: new Date().toISOString(),
    audioBlob: params.audioFile,
    coverBlob: params.coverFile || null,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return toSong(record);
}

export async function getLocalTracks(): Promise<Song[]> {
  const db = await openDb();
  const records = await new Promise<LocalTrackRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as LocalTrackRecord[]);
    req.onerror = () => reject(req.error);
  });
  return records
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toSong);
}

export async function deleteLocalTrack(id: string): Promise<void> {
  const cached = blobUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached.audio);
    if (cached.cover) URL.revokeObjectURL(cached.cover);
    blobUrlCache.delete(id);
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
