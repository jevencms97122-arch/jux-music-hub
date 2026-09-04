import { pb } from './pocketbase';

/**
 * Total d'écoutes de l'utilisateur, dans `user_stats` — sert aux quêtes
 * d'écoute du système de rang (première écoute, auditeur assidu, etc.).
 * Anciennement couplé au système de série/flamme (current_streak,
 * longest_streak) : retiré, ce fichier ne garde que le compteur total.
 */
export async function recordListen(userId: string): Promise<void> {
  try {
    const records = await pb.collection('user_stats').getList(1, 1, {
      filter: `user_id = "${userId}"`,
      requestKey: null,
    });

    if (records.items.length === 0) {
      await pb.collection('user_stats').create({ user_id: userId, total_listens: 1 });
      return;
    }

    const existing = records.items[0];
    await pb.collection('user_stats').update(existing.id, {
      total_listens: (existing.total_listens ?? 0) + 1,
    });
  } catch (e) {
    console.error('recordListen', e);
  }
}

export async function getUserStats(userId: string) {
  try {
    const records = await pb.collection('user_stats').getList(1, 1, {
      filter: `user_id = "${userId}"`,
      requestKey: null,
    });
    return records.items.length > 0 ? records.items[0] : null;
  } catch (e) {
    console.error('getUserStats', e);
    return null;
  }
}
