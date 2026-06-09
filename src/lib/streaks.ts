import { pb } from './pocketbase';

/** Met à jour la série d'écoute quotidienne de l'utilisateur. */
export async function updateStreak(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const records = await pb.collection('user_stats').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    });

    if (records.items.length === 0) {
      await pb.collection('user_stats').create({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        total_listens: 1,
        last_listen_date: today,
      });
      return;
    }

    const existing = records.items[0];
    const lastDate = existing.last_listen_date as string;

    if (lastDate === today) {
      await pb.collection('user_stats').update(existing.id, {
        total_listens: (existing.total_listens ?? 0) + 1,
      });
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentStreak = existing.current_streak ?? 0;
    const longestStreak = existing.longest_streak ?? 0;
    const newStreak = lastDate === yesterdayStr ? currentStreak + 1 : 1;
    const newLongestStreak = Math.max(newStreak, longestStreak);

    await pb.collection('user_stats').update(existing.id, {
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      total_listens: (existing.total_listens ?? 0) + 1,
      last_listen_date: today,
    });
  } catch (e) {
    console.error('updateStreak', e);
  }
}

export async function getUserStats(userId: string) {
  try {
    const records = await pb.collection('user_stats').getList(1, 1, {
      filter: `user_id = "${userId}"`,
    });
    return records.items.length > 0 ? records.items[0] : null;
  } catch (e) {
    console.error('getUserStats', e);
    return null;
  }
}