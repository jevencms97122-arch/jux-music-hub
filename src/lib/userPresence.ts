import { pb } from './pocketbase';

/**
 * Met à jour la présence de l'utilisateur (ce qu'il écoute actuellement).
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

    // PocketBase upsert: find existing record first
    const existing = await pb.collection('user_presence').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    });

    if (existing.items.length > 0) {
      await pb.collection('user_presence').update(existing.items[0].id, upsertData);
    } else {
      await pb.collection('user_presence').create(upsertData);
    }
  } catch (e) {
    console.error('updatePresence', e);
  }
}

/**
 * Marque l'utilisateur comme hors ligne (arrêt de la musique).
 */
export async function clearPresence(userId: string) {
  try {
    const existing = await pb.collection('user_presence').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    });
    
    if (existing.items.length > 0) {
      await pb.collection('user_presence').update(existing.items[0].id, {
        user_id: userId,
        is_listening: false,
        current_song_id: null,
        current_song_title: null,
        current_song_author: null,
        current_song_cover_url: null,
        last_seen_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('clearPresence', e);
  }
}

/**
 * Heartbeat rapide : met juste à jour last_seen_at.
 * Appelé toutes les 3s via setInterval dans App.tsx.
 */
export async function pingPresence(userId: string) {
  try {
    const existing = await pb.collection('user_presence').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    });

    if (existing.items.length > 0) {
      await pb.collection('user_presence').update(existing.items[0].id, {
        last_seen_at: new Date().toISOString(),
      });
    } else {
      await pb.collection('user_presence').create({
        user_id: userId,
        is_listening: false,
        last_seen_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Silence is golden
  }
}