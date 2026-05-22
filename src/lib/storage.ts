import { supabase } from '@/integrations/supabase/client';

/** URL publique d'un fichier dans un bucket Supabase Storage. */
export function publicUrl(bucket: 'songs' | 'covers' | 'avatars', path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function songCoverUrl(song: { cover_url?: string | null }): string {
  return song.cover_url ? publicUrl('covers', song.cover_url) : '/placeholder.svg';
}

export function songAudioUrl(song: { audio_url: string }): string {
  return publicUrl('songs', song.audio_url);
}

export function avatarUrl(profile: { avatar_url?: string | null }): string {
  return profile.avatar_url ? publicUrl('avatars', profile.avatar_url) : '';
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
  // Fallback pour les environnements sans crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Upload un fichier dans le bucket donné, sous user_id/<filename>. Retourne le chemin stocké. */
export async function uploadFile(
  bucket: 'songs' | 'covers' | 'avatars',
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${generateUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function deleteFile(
  bucket: 'songs' | 'covers' | 'avatars',
  path: string,
): Promise<void> {
  if (!path || path.startsWith('http')) return;
  await supabase.storage.from(bucket).remove([path]);
}
