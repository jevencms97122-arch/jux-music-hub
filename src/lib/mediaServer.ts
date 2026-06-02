/**
 * Upload/suppression de fichiers vers un serveur média externe (PocketBase ou
 * tout endpoint compatible) configurable via VITE_MEDIA_BASE_URL.
 *
 * Si VITE_MEDIA_BASE_URL n'est pas défini, les helpers retournent null pour
 * laisser le code appelant retomber sur Supabase Storage.
 *
 * IMPORTANT: le serveur DOIT être accessible en HTTPS — sinon les navigateurs
 * bloqueront le contenu (mixed content) depuis https://juxmusicfree.lovable.app.
 *
 * ─ Côté PocketBase, créer une collection `media` (modifiable via
 *   VITE_MEDIA_COLLECTION) avec les champs :
 *   - kind   (text)
 *   - owner_id (text)
 *   - file   (file, single)
 *   et listRule / viewRule / createRule = "" (public).
 *
 * ─ CORS : autoriser https://juxmusicfree.lovable.app et *.lovableproject.com
 */

export type MediaKind = 'audio' | 'cover' | 'avatar';

const DEFAULT_MEDIA_BASE_URL = 'https://feat-success-cgi-disclaimer.trycloudflare.com';
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
  // PocketBase file fields are usually arrays of filenames; accept string or string[]
  file: string | string[];
  [k: string]: any;
}

/**
 * Upload un fichier vers le serveur média.
 * Retourne l'URL HTTPS complète et publique à stocker en DB.
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

  // PocketBase may return the file field as an array of filenames.
  let filename: string | null = null;
  if (Array.isArray(record.file)) filename = record.file[0] ?? null;
  else if (typeof record.file === 'string') filename = record.file;

  if (!filename) {
    throw new Error('Impossible de déterminer le nom de fichier renvoyé par le serveur média');
  }

  // URL publique PocketBase : /api/files/<collection>/<recordId>/<filename>
  return `${BASE}/api/files/${COLLECTION}/${record.id}/${filename}`;
}

/** Supprime un fichier média à partir de son URL publique. Best-effort. */
export async function deleteMedia(url: string): Promise<void> {
  if (!BASE || !url || !url.startsWith(BASE)) return;
  // Pattern : <BASE>/api/files/<collection>/<recordId>/<filename>
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
