import { pb } from './pocketbase';
import { songCoverUrl } from './storage';

/**
 * Récupère, pour chaque playlist, un tableau de 0, 1 ou 4 covers :
 * - 0 titre → []
 * - 1 à 3 titres → 1 cover
 * - 4+ titres → 4 covers choisies aléatoirement parmi les titres de la playlist
 */
export async function fetchPlaylistCovers(playlistIds: string[]): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (playlistIds.length === 0) return result;

  const filters = playlistIds.map((id) => `playlist_id = "${id}"`).join(' || ');
  const ps = await pb.collection('playlist_songs').getList(1, 1000, { filter: filters, requestKey: null });

  const byPlaylist: Record<string, string[]> = {};
  for (const r of ps.items as any[]) {
    if (!r.playlist_id || !r.song_id) continue;
    (byPlaylist[r.playlist_id] ||= []).push(r.song_id);
  }

  const allSongIds = Array.from(new Set(Object.values(byPlaylist).flat()));
  const songCoverById: Record<string, string> = {};
  for (let i = 0; i < allSongIds.length; i += 50) {
    const batch = allSongIds.slice(i, i + 50);
    const f = batch.map((id) => `id = "${id}"`).join(' || ');
    const res = await pb.collection('songs').getList(1, 50, { filter: f, requestKey: null });
    for (const s of res.items as any[]) {
      const url = songCoverUrl(s);
      if (url) songCoverById[s.id] = url;
    }
  }

  for (const id of playlistIds) {
    const songIds = byPlaylist[id] || [];
    const shuffled = [...songIds].sort(() => Math.random() - 0.5);
    const covers = shuffled.map((sid) => songCoverById[sid]).filter(Boolean);
    if (covers.length >= 4) result[id] = covers.slice(0, 4);
    else if (covers.length >= 1) result[id] = [covers[0]];
    else result[id] = [];
  }

  return result;
}
