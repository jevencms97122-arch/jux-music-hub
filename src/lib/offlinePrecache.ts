import { pb } from '@/lib/pocketbase';
import { queueSongsForOffline } from '@/lib/offlineManager';
import type { Song } from '@/types/music';

const PRECACHE_LIMIT_LIKES = 30;
const PRECACHE_LIMIT_HISTORY = 20;

function recordToSong(r: any): Song {
  return {
    id: r.id,
    title: r.title || '',
    author: r.author || '',
    audio: r.audio || '',
    cover: r.cover || null,
    audio_url: r.audio_url || '',
    cover_url: r.cover_url || null,
    video_url: r.video_url || null,
    genre: r.genre || null,
    uploaded_by: r.uploaded_by || '',
    duration: r.duration || 0,
    play_count: r.play_count ?? 0,
    likes_count: r.likes_count ?? 0,
    created_at: r.created,
    updated_at: r.updated,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
  };
}

async function fetchSongsByIds(ids: string[]): Promise<Song[]> {
  const result: Song[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const batch = ids.slice(i, i + 30);
    const filter = batch.map((id) => `id = "${id}"`).join(' || ');
    try {
      const res = await pb.collection('songs').getList(1, 30, { filter, requestKey: null });
      result.push(...res.items.map(recordToSong));
    } catch {}
  }
  return result;
}

let precacheStarted = false;

/**
 * Pré-télécharge en tâche de fond (quand on est EN LIGNE) les sons que
 * l'utilisateur voudra probablement écouter hors connexion : ses titres likés
 * et ses écoutes récentes. Sans ça, le "mode hors connexion" n'aurait rien à
 * offrir — on ne peut pas télécharger une fois le réseau coupé.
 *
 * Une seule exécution par session d'app (les écoutes suivantes passent par
 * ensureCachedForPlayback à la lecture).
 */
export async function precacheLibraryForOffline(userId: string): Promise<void> {
  if (precacheStarted) return;
  precacheStarted = true;

  try {
    const [likesRes, histRes] = await Promise.all([
      pb.collection('song_likes').getList(1, PRECACHE_LIMIT_LIKES, {
        filter: `user_id = "${userId}"`,
        sort: '-created',
        requestKey: null,
      }).catch(() => ({ items: [] as any[] })),
      pb.collection('listen_history').getList(1, PRECACHE_LIMIT_HISTORY * 3, {
        filter: `user_id = "${userId}"`,
        sort: '-listened_at',
        requestKey: null,
      }).catch(() => ({ items: [] as any[] })),
    ]);

    const likedIds = likesRes.items.map((l: any) => l.song_id as string);
    const histIds = [...new Set(histRes.items.map((h: any) => h.song_id as string))].slice(0, PRECACHE_LIMIT_HISTORY);
    const ids = [...new Set([...likedIds, ...histIds])].filter((id) => id && !id.startsWith('local_'));
    if (ids.length === 0) return;

    const songs = await fetchSongsByIds(ids);
    await queueSongsForOffline(songs);
  } catch (e) {
    console.error('[offlinePrecache] failed', e);
  }
}
