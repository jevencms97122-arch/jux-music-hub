import { supabase } from '@/integrations/supabase/client';

/**
 * Met à jour la présence de l'utilisateur (ce qu'il écoute actuellement).
 * Appelé à chaque changement de chanson et à la mise en pause/arrêt.
 */
export async function updatePresence(payload: {
  userId: string;
  isListening: boolean;
  songId?: string;
  songTitle?: string;
  songAuthor?: string;
  songCoverUrl?: string;
}) {
  try {
    const { userId, isListening, songId, songTitle, songAuthor, songCoverUrl } = payload;

    const upsertData: Record<string, any> = {
      user_id: userId,
      is_listening: isListening,
      last_seen_at: new Date().toISOString(),
    };

    if (songId) upsertData.current_song_id = songId;
    if (songTitle) upsertData.current_song_title = songTitle;
    if (songAuthor) upsertData.current_song_author = songAuthor;
    if (songCoverUrl) upsertData.current_song_cover_url = songCoverUrl;

    await (supabase as any).from('user_presence').upsert(upsertData, {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    });
  } catch (e) {
    console.error('updatePresence', e);
  }
}

/**
 * Marque l'utilisateur comme hors ligne (arrêt de la musique).
 */
export async function clearPresence(userId: string) {
  try {
    await (supabase as any).from('user_presence').upsert({
      user_id: userId,
      is_listening: false,
      current_song_id: null,
      current_song_title: null,
      current_song_author: null,
      current_song_cover_url: null,
      last_seen_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    });
  } catch (e) {
    console.error('clearPresence', e);
  }
}

/**
 * Heartbeat rapide : met juste à jour last_seen_at.
 * N'écrase JAMAIS is_listening, current_song_id, etc.
 * Appelé toutes les 3s via setInterval dans App.tsx.
 */
export async function pingPresence(userId: string) {
  try {
    await (supabase as any).from('user_presence').upsert({
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    });
  } catch (e) {
    // Silence is golden
  }
}
