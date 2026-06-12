import { pb } from './pocketbase';
import type { Song } from '@/types/music';
import { recordToSong } from './pbUtils';

export interface DailyMixResult {
  songs: Song[];
  genre: string | null;
}


/**
 * Génère un Daily Mix basé sur le genre le plus écouté sur les 3 derniers jours.
 */
export async function generateDailyMix(userId: string): Promise<DailyMixResult> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const historyRes = await pb.collection('listen_history').getList(1, 500, {
      filter: `user_id = "${userId}" && listened_at >= "${threeDaysAgo}"`,
      sort: '-listened_at',
    });

    const recentSongIds = Array.from(new Set(historyRes.items.map((h: any) => h.song_id)));

    // Récupère les songs écoutées pour trouver les genres
    let recentListened: Song[] = [];
    if (recentSongIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < recentSongIds.length; i += batchSize) {
        const batch = recentSongIds.slice(i, i + batchSize);
        const filters = batch.map(id => `id = "${id}"`).join(' || ');
        const res = await pb.collection('songs').getList(1, batchSize, { filter: filters });
        recentListened.push(...res.items.map(recordToSong));
      }
    }

    // Genre le plus écouté sur 3 jours
    const genreCount = new Map<string, number>();
    // On compte chaque écoute (pas juste unique) pour le poids réel
    for (const h of historyRes.items) {
      const song = recentListened.find(s => s.id === h.song_id);
      if (song?.genre) {
        genreCount.set(song.genre, (genreCount.get(song.genre) ?? 0) + 1);
      }
    }

    const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Fallback si pas assez d'historique récent → top populaires
    if (recentSongIds.length < 3 || !topGenre) {
      const res = await pb.collection('songs').getList(1, 20, { sort: '-play_count' });
      return { songs: res.items.map(recordToSong), genre: null };
    }

    // Charge les songs du genre dominant
    const genreRes = await pb.collection('songs').getList(1, 100, {
      filter: `genre = "${topGenre.replace(/"/g, '')}"`,
      sort: '-play_count',
    });
    const genreSongs = genreRes.items.map(recordToSong);

    const seed = new Date().toISOString().slice(0, 10);
    const alreadyHeard = genreSongs.filter(s => recentSongIds.includes(s.id));
    const fresh = genreSongs.filter(s => !recentSongIds.includes(s.id));

    const favs = shuffleSeeded(alreadyHeard, seed + ':f').slice(0, 10);
    const news = shuffleSeeded(fresh, seed + ':n').slice(0, 10);
    const mix = shuffleSeeded([...favs, ...news], seed);

    return { songs: mix, genre: topGenre };
  } catch (err) {
    console.error('Daily mix error:', err);
    return { songs: [], genre: null };
  }
}

function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  const rand = mulberry32(hash(seed));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
