/**
 * Upload/suppression de fichiers vers un serveur média externe (optionnel).
 * 
 * Si VITE_MEDIA_BASE_URL est défini, on utilise ce serveur externe pour stocker
 * les fichiers audio/covers/avatars.
 * 
 * Si non défini, les fichiers sont gérés directement par PocketBase via les
 * champs file des collections dédiées (songs.audio, songs.cover, profiles.avatar).
 * 
 * IMPORTANT: Cette logique média externe est un héritage de l'ancienne collection
 * "media". Pour toute nouvelle utilisation, préférer l'upload direct vers les
 * collections PocketBase (songs, profiles) avec les champs file.
 */

export type MediaKind = 'audio' | 'cover' | 'avatar';

const DEFAULT_MEDIA_BASE_URL = '';
const BASE = (import.meta.env.VITE_MEDIA_BASE_URL || DEFAULT_MEDIA_BASE_URL).replace(/\/+$/, '');
const COLLECTION = import.meta.env.VITE_MEDIA_COLLECTION || 'media';

export function isMediaServerConfigured(): boolean {
  return !!BASE;
}

export function getMediaBaseUrl(): string {
  return BASE;
}

/** Détecte si une URL provient du serveur média externe. */
export function isExternalMediaUrl(url: string | null | undefined): boolean {
  if (!url || !BASE) return false;
  return url.startsWith(BASE);
}

interface PocketBaseRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  file: string | string[];
  [k: string]: any;
}

/**
 * Upload un fichier vers le serveur média externe.
 * Retourne l'URL complète du fichier.
 * NOTE: Cette fonction est réservée à la rétrocompatibilité.
 * Pour les nouveaux uploads, utiliser directement les champs file des collections.
 */
export async function uploadMedia(
  kind: MediaKind,
  file: File,
  ownerId: string,
): Promise<string> {
  if (!BASE) throw new Error('VITE_MEDIA_BASE_URL non configuré');
  const API_KEY = import.meta.env.VITE_MEDIA_API_KEY || '';

  const form = new FormData();
  form.append('file', file, file.name);
  form.append('kind', kind);
  form.append('owner_id', ownerId);

  const headers: Record<string, string> = {};
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE}/api/collections/${COLLECTION}/records`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload média échoué [${res.status}]: ${text.slice(0, 300)}`);
  }

  const record = (await res.json()) as PocketBaseRecord;
  if (!record?.id || !record?.file) {
    throw new Error('Réponse serveur média invalide');
  }

  let filename: string | null = null;
  if (Array.isArray(record.file)) filename = record.file[0] ?? null;
  else if (typeof record.file === 'string') filename = record.file;

  if (!filename) {
    throw new Error('Impossible de déterminer le nom de fichier renvoyé par le serveur média');
  }

  return `${BASE}/api/files/${COLLECTION}/${record.id}/${filename}`;
}

/** Supprime un fichier média à partir de son URL publique. Best-effort. */
export async function deleteMedia(url: string): Promise<void> {
  if (!BASE || !url || !url.startsWith(BASE)) return;
  const match = url.match(/\/api\/files\/([^/]+)\/([^/]+)\//);
  if (!match) return;
  const [, collection, recordId] = match;
  try {
    await fetch(`${BASE}/api/collections/${collection}/records/${recordId}`, {
      method: 'DELETE',
    });
  } catch {
    /* best-effort */
  }
}