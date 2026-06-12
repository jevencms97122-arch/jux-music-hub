import { pb } from './pocketbase';

// Cache: userId → presence record id — évite un getList à chaque mise à jour
const presenceIdCache = new Map<string, string>();

async function findOrCreatePresenceId(userId: string): Promise<string | null> {
  try {
    const res = await pb.collection('user_presence').getList(1, 1, {
      filter: `user_id = "${userId}"`,
      requestKey: null,
    });
    if (res.items.length > 0) {
      presenceIdCache.set(userId, res.items[0].id);
      return res.items[0].id;
    }
    const created = await pb.collection('user_presence').create({
      user_id: userId,
      is_listening: false,
      last_seen_at: new Date().toISOString(),
    });
    presenceIdCache.set(userId, created.id);
    return created.id;
  } catch {
    return null;
  }
}

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
    const data: Record<string, any> = {
      user_id: userId,
      is_listening: isListening,
      last_seen_at: new Date().toISOString(),
    };
    if (songId) data.current_song_id = songId;
    if (songTitle) data.current_song_title = songTitle;
    if (songAuthor) data.current_song_author = songAuthor;
    if (songCoverUrl) data.current_song_cover_url = songCoverUrl;

    const cachedId = presenceIdCache.get(userId);
    if (cachedId) {
      try {
        await pb.collection('user_presence').update(cachedId, data, { requestKey: null });
        return;
      } catch {
        presenceIdCache.delete(userId);
      }
    }
    const id = await findOrCreatePresenceId(userId);
    if (id) await pb.collection('user_presence').update(id, data, { requestKey: null });
  } catch {}
}

export async function clearPresence(userId: string) {
  try {
    const data = {
      user_id: userId,
      is_listening: false,
      current_song_id: null,
      current_song_title: null,
      current_song_author: null,
      current_song_cover_url: null,
      last_seen_at: new Date().toISOString(),
    };
    const cachedId = presenceIdCache.get(userId);
    if (cachedId) {
      try {
        await pb.collection('user_presence').update(cachedId, data, { requestKey: null });
        return;
      } catch {
        presenceIdCache.delete(userId);
      }
    }
    const id = await findOrCreatePresenceId(userId);
    if (id) await pb.collection('user_presence').update(id, data, { requestKey: null });
  } catch {}
}

export async function pingPresence(userId: string) {
  try {
    const data = { last_seen_at: new Date().toISOString() };
    const cachedId = presenceIdCache.get(userId);
    if (cachedId) {
      try {
        await pb.collection('user_presence').update(cachedId, data, { requestKey: null });
        return;
      } catch {
        presenceIdCache.delete(userId);
      }
    }
    const id = await findOrCreatePresenceId(userId);
    if (id) await pb.collection('user_presence').update(id, data, { requestKey: null });
  } catch {}
}