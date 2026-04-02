import { pb } from './pocketbase';

export async function updateStreak(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Try to find existing stats
    const existing = await pb.collection('user_stats').getList(1, 1, {
      filter: `user="${userId}"`,
    });

    if (existing.items.length === 0) {
      // Create new stats record
      await pb.collection('user_stats').create({
        user: userId,
        currentStreak: 1,
        longestStreak: 1,
        totalListens: 1,
        lastListenDate: today,
      });
      return;
    }

    const stats = existing.items[0];
    const lastDate = stats.lastListenDate ? stats.lastListenDate.split('T')[0] : '';

    if (lastDate === today) {
      // Already listened today, just increment total
      await pb.collection('user_stats').update(stats.id, {
        'totalListens+': 1,
      });
      return;
    }

    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak: number;
    if (lastDate === yesterdayStr) {
      newStreak = (stats.currentStreak || 0) + 1;
    } else {
      newStreak = 1; // Streak broken
    }

    const longestStreak = Math.max(newStreak, stats.longestStreak || 0);

    await pb.collection('user_stats').update(stats.id, {
      currentStreak: newStreak,
      longestStreak,
      'totalListens+': 1,
      lastListenDate: today,
    });
  } catch (error) {
    console.error('Error updating streak:', error);
  }
}

export async function getUserStats(userId: string) {
  try {
    const res = await pb.collection('user_stats').getList(1, 1, {
      filter: `user="${userId}"`,
    });
    return res.items[0] || null;
  } catch {
    return null;
  }
}
