import { pb } from '@/lib/pocketbase';

const KEY = 'jux_offline_pending_plays';
const MAX_ENTRIES = 500;

interface PendingPlay {
  songId: string;
  listenedAt: string; // ISO
}

function readQueue(): PendingPlay[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(arr) ? arr.filter((p) => p && typeof p.songId === 'string') : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingPlay[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue.slice(-MAX_ENTRIES)));
  } catch {
    // stockage plein : on abandonne silencieusement
  }
}

/** Enregistre une écoute faite hors connexion, pour la pousser au serveur plus tard. */
export function queueOfflinePlay(songId: string) {
  if (songId.startsWith('local_')) return; // sons locaux : n'existent pas côté serveur
  const queue = readQueue();
  queue.push({ songId, listenedAt: new Date().toISOString() });
  writeQueue(queue);
}

export function pendingOfflinePlaysCount(): number {
  return readQueue().length;
}

/**
 * Pousse au serveur les écoutes accumulées hors ligne : entrées `listen_history`
 * + incrément des compteurs de lecture. Vide la file au fur et à mesure ;
 * en cas d'échec réseau, les entrées restantes seront retentées plus tard.
 */
export async function flushOfflinePlays(userId: string): Promise<number> {
  let queue = readQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  // Compte les écoutes par son pour ne faire qu'un update de play_count par titre
  const countBySong = new Map<string, number>();

  while (queue.length > 0) {
    const play = queue[0];
    try {
      await pb.collection('listen_history').create({
        user_id: userId,
        song_id: play.songId,
        listened_at: play.listenedAt,
      });
      countBySong.set(play.songId, (countBySong.get(play.songId) ?? 0) + 1);
      queue = queue.slice(1);
      writeQueue(queue);
      synced++;
    } catch {
      // Réseau retombé (ou son supprimé) : on arrête, on retentera plus tard.
      // Si le son n'existe plus, l'entrée serait bloquante — on la saute après
      // vérification.
      try {
        const exists = await pb.collection('songs').getList(1, 1, { filter: `id = "${play.songId}"`, requestKey: null });
        if (exists.items.length === 0) {
          queue = queue.slice(1);
          writeQueue(queue);
          continue;
        }
      } catch {
        // vraiment hors ligne
      }
      break;
    }
  }

  // Incrémente play_count une fois par titre (total des écoutes offline)
  for (const [songId, count] of countBySong) {
    try {
      const res = await pb.collection('songs').getList(1, 1, { filter: `id = "${songId}"`, requestKey: null });
      const record = res.items[0];
      if (record) {
        await pb.collection('songs').update(record.id, { play_count: (record.play_count ?? 0) + count });
      }
    } catch {
      // non bloquant
    }
  }

  return synced;
}
