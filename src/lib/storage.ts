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

/** Upload un fichier dans le bucket donné, sous user_id/<filename>. Retourne le chemin stocké. */
export async function uploadFile(
  bucket: 'songs' | 'covers' | 'avatars',
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
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
