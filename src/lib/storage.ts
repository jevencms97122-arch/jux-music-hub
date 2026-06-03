import { pb, getPbUrl } from './pocketbase';
import { isMediaServerConfigured, uploadMedia, type MediaKind } from './mediaServer';

/** URL publique d'un fichier depuis PocketBase */
export function publicUrl(collectionName: string, recordId: string, filename: string): string {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;
  return pb.files.getUrl({ id: recordId, collectionName } as any, filename);
}

export function songCoverUrl(song: { cover_url?: string | null; id?: string; collectionId?: string; collectionName?: string }): string {
  if (!song.cover_url) return '/placeholder.svg';
  if (song.cover_url.startsWith('http')) return song.cover_url;
  if (song.collectionName && song.id) {
    return publicUrl(song.collectionName, song.id, song.cover_url);
  }
  return `/placeholder.svg`;
}

export function songAudioUrl(song: { audio_url: string; id?: string; collectionName?: string }): string {
  if (song.audio_url.startsWith('http')) return song.audio_url;
  if (song.collectionName && song.id) {
    return publicUrl(song.collectionName, song.id, song.audio_url);
  }
  return song.audio_url;
}

export function avatarUrl(profile: { avatar_url?: string | null; id?: string; collectionName?: string }): string {
  if (!profile.avatar_url) return '';
  if (profile.avatar_url.startsWith('http')) return profile.avatar_url;
  if (profile.collectionName && profile.id) {
    return publicUrl(profile.collectionName, profile.id, profile.avatar_url);
  }
  return profile.avatar_url;
}

/** Extrait l'ID YouTube depuis n'importe quel format de lien YouTube */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Génère un UUID compatible partout (fallback si crypto.randomUUID n'existe pas) */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const BUCKET_TO_KIND: Record<string, MediaKind> = {
  songs: 'audio',
  covers: 'cover',
  avatars: 'avatar',
};

/**
 * Upload "smart" : envoie vers le serveur média externe si VITE_MEDIA_BASE_URL
 * est défini, sinon URL directe (PocketBase gère les fichiers).
 */
export async function uploadFileSmart(
  bucket: 'songs' | 'covers' | 'avatars' | string,
  userId: string,
  file: File,
): Promise<string> {
  if (isMediaServerConfigured()) {
    return uploadMedia(BUCKET_TO_KIND[bucket] || 'audio', file, userId);
  }
  // Fallback: upload direct vers PocketBase via la collection media
  return uploadMedia(BUCKET_TO_KIND[bucket] || 'audio', file, userId);
}

export async function deleteFile(
  bucket: string,
  path: string,
): Promise<void> {
  if (!path || path.startsWith('http')) return;
  // PocketBase: we can't easily delete by path, best-effort
  try {
    // Try to find and delete from media collection
    const records = await pb.collection('media').getList(1, 50, {
      filter: `file = "${path}"`,
    });
    for (const record of records.items) {
      await pb.collection('media').delete(record.id);
    }
  } catch (e) {
    console.error('deleteFile error:', e);
  }
}