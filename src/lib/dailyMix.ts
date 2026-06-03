import { pb } from './pocketbase';
import type { Song } from '@/types/music';

function recordToSong(r: any): Song {
  return {
    id: r.id,
    title: r.get('title') || '',
    author: r.get('author') || '',
    audio_url: r.get('audio_url') || '',
    cover_url: r.get('cover_url') || null,
    video_url: r.get('video_url') || null,
    genre: r.get('genre') || null,
    uploaded_by: r.get('uploaded_by') || '',
    play_count: r.get('play_count') ?? 0,
    weekly_play_count: r.get('weekly_play_count') ?? 0,
    likes_count: r.get('likes_count') ?? 0,
    created_at: r.get('created') || r.created,
    updated_at: r.get('updated') || r.updated,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
  };
}

/**
 * Génère un Daily Mix basé sur l'historique d'écoute.
 */
export async function generateDailyMix(userId: string): Promise<Song[]> {
  try {
    const historyRes = await pb.collection('listen_history').getList(1, 100, {
      filter: `user_id = "${userId}"`,
      sort: '-listened_at',
    });

    const songIds = Array.from(new Set(historyRes.items.map((h: any) => h.get('song_id'))));

    let listened: Song[] = [];
    if (songIds.length > 0) {
      // Fetch songs in batches since PB doesn't support in() filter natively via SDK
      const batchSize = 50;
      for (let i = 0; i < songIds.length; i += batchSize) {
        const batch = songIds.slice(i, i + batchSize);
        const filters = batch.map(id => `id = "${id}"`).join(' || ');
        const res = await pb.collection('songs').getList(1, batchSize, {
          filter: filters,
        });
        listened.push(...res.items.map(recordToSong));
      }
    }

    // Genres et auteurs préférés
    const genreCount = new Map<string, number>();
    const authorCount = new Map<string, number>();
    listened.forEach((s) => {
      if (s.genre) genreCount.set(s.genre, (genreCount.get(s.genre) ?? 0) + 1);
      if (s.author) authorCount.set(s.author, (authorCount.get(s.author) ?? 0) + 1);
    });
    const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);

    // Découvertes : titres jamais écoutés, dans les genres préférés
    let discovery: Song[] = [];
    if (topGenres.length > 0) {
      const genreFilters = topGenres.map(g => `genre = "${g}"`).join(' || ');
      const res = await pb.collection('songs').getList(1, 60, {
        filter: genreFilters,
        sort: '-play_count',
      });
      discovery = res.items.map(recordToSong).filter((s) => !songIds.includes(s.id));
    }

    // Si pas assez d'historique → top 20 populaires
    if (listened.length < 5 && discovery.length < 5) {
      const res = await pb.collection('songs').getList(1, 20, {
        sort: '-play_count',
      });
      return res.items.map(recordToSong);
    }

    // Mix : 10 favoris + 10 découvertes, mélangés avec seed quotidien
    const seed = new Date().toISOString().slice(0, 10);
    const favs = shuffleSeeded(listened.slice(0, 30), seed + ':f').slice(0, 10);
    const news = shuffleSeeded(discovery, seed + ':n').slice(0, 10);
    return shuffleSeeded([...favs, ...news], seed);
  } catch (err) {
    console.error('Daily mix error:', err);
    return [];
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