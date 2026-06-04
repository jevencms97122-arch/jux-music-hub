import { pb, getPbUrl } from './pocketbase';
import { isMediaServerConfigured, uploadMedia, type MediaKind } from './mediaServer';

/** URL publique d'un fichier depuis PocketBase */
export function publicUrl(collectionName: string, recordId: string, filename: string): string {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;
  return pb.files.getUrl({ id: recordId, collectionName } as any, filename);
}

export function songCoverUrl(song: { cover?: string; cover_url?: string | null; id?: string; collectionId?: string; collectionName?: string }): string {
  // Nouveau champ file "cover" de PocketBase
  if (song.cover) {
    if (song.cover.startsWith('http')) return song.cover;
    if (song.collectionName && song.id) {
      return publicUrl(song.collectionName, song.id, song.cover);
    }
  }
  // Ancien champ texte "cover_url" (rétrocompatibilité)
  if (song.cover_url) {
    if (song.cover_url.startsWith('http')) return song.cover_url;
    if (song.collectionName && song.id) {
      return publicUrl(song.collectionName, song.id, song.cover_url);
    }
  }
  return '/placeholder.svg';
}

export function songAudioUrl(song: { audio?: string; audio_url?: string; id?: string; collectionName?: string }): string {
  // Nouveau champ file "audio" de PocketBase
  if (song.audio) {
    if (song.audio.startsWith('http')) return song.audio;
    if (song.collectionName && song.id) {
      return publicUrl(song.collectionName, song.id, song.audio);
    }
  }
  // Ancien champ texte "audio_url" (rétrocompatibilité)
  if (song.audio_url) {
    if (song.audio_url.startsWith('http')) return song.audio_url;
    if (song.collectionName && song.id) {
      return publicUrl(song.collectionName, song.id, song.audio_url);
    }
  }
  return '';
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

/**
 * Upload "smart" : envoie vers le serveur média externe si VITE_MEDIA_BASE_URL
 * est défini, sinon utilise PocketBase directement via les champs file.
 */
export async function uploadFileSmart(
  bucket: 'songs' | 'covers' | 'avatars' | string,
  userId: string,
  file: File,
): Promise<string> {
  if (isMediaServerConfigured()) {
    return uploadMedia(bucket === 'songs' ? 'audio' : bucket === 'covers' ? 'cover' : 'avatar', file, userId);
  }
  // Pas de serveur média externe : l'upload se fait via les champs file de PocketBase
  // directement dans la collection dédiée (songs.audio, songs.cover, profiles.avatar)
  return '';
}

/**
 * Supprime un fichier. Si le serveur média externe est utilisé, on appelle deleteMedia.
 * Sinon, on ne peut pas supprimer facilement via PocketBase, best-effort via le champ file.
 */
export async function deleteFile(
  bucket: string,
  path: string,
): Promise<void> {
  if (!path || path.startsWith('http')) {
    // Fichier hébergé sur le serveur média externe — on tente de le supprimer
    try {
      const { deleteMedia } = await import('./mediaServer');
      await deleteMedia(path);
    } catch { /* best-effort */ }
    return;
  }
  // Fichier PocketBase géré directement via les champs file des collections dédiées
  // PocketBase nettoie automatiquement les fichiers orphelins.
  // Pas besoin d'action manuelle.
}