import { supabase } from '@/integrations/supabase/client';
import type { Song } from '@/types/music';

/**
 * Génère un Daily Mix basé sur l'historique d'écoute.
 * - Récupère les 100 derniers titres écoutés
 * - Identifie les genres/auteurs préférés
 * - Sélectionne ~20 titres : moitié déjà aimés, moitié découvertes du même genre
 * - Stable pendant la journée (seed = date)
 */
export async function generateDailyMix(userId: string): Promise<Song[]> {
  try {
    const { data: history } = await supabase
      .from('listen_history')
      .select('song_id, listened_at')
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(100);

    const songIds = Array.from(new Set((history ?? []).map((h: any) => h.song_id)));

    let listened: Song[] = [];
    if (songIds.length > 0) {
      const { data } = await supabase.from('songs').select('*').in('id', songIds);
      listened = (data ?? []) as Song[];
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
      const { data } = await supabase
        .from('songs')
        .select('*')
        .in('genre', topGenres)
        .order('play_count', { ascending: false })
        .limit(60);
      discovery = ((data ?? []) as Song[]).filter((s) => !songIds.includes(s.id));
    }

    // Si pas assez d'historique → top 20 populaires
    if (listened.length < 5 && discovery.length < 5) {
      const { data } = await supabase
        .from('songs').select('*')
        .order('play_count', { ascending: false }).limit(20);
      return (data ?? []) as Song[];
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
