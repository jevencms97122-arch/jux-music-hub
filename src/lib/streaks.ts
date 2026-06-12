import { pb } from './pocketbase';

// Days since Unix epoch — works with Number field type in PocketBase
const todayDay = () => Math.floor(Date.now() / 86400000);

/** Met à jour la série d'écoute quotidienne de l'utilisateur. */
export async function updateStreak(userId: string): Promise<void> {
  try {
    const today = todayDay();

    const records = await pb.collection('user_stats').getList(1, 1, {
      filter: `user_id = "${userId}"`,
      requestKey: null,
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
    const lastDay = (existing.last_listen_date as number) || 0;

    if (lastDay === today) {
      // Already recorded today — only bump total listens
      await pb.collection('user_stats').update(existing.id, {
        total_listens: (existing.total_listens ?? 0) + 1,
      });
      return;
    }

    const currentStreak = existing.current_streak ?? 0;
    const longestStreak = existing.longest_streak ?? 0;
    // Streak continues only if last listen was exactly yesterday
    const newStreak = lastDay === today - 1 ? currentStreak + 1 : 1;
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
      requestKey: null,
    });
    return records.items.length > 0 ? records.items[0] : null;
  } catch (e) {
    console.error('getUserStats', e);
    return null;
  }
}
