import { supabase } from '@/integrations/supabase/client';

/** Met à jour la série d'écoute quotidienne de l'utilisateur. */
export async function updateStreak(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('user_stats').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        total_listens: 1,
        last_listen_date: today,
      });
      return;
    }

    const lastDate = existing.last_listen_date;

    if (lastDate === today) {
      await supabase
        .from('user_stats')
        .update({ total_listens: (existing.total_listens ?? 0) + 1 })
        .eq('id', existing.id);
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const newStreak = lastDate === yesterdayStr ? (existing.current_streak ?? 0) + 1 : 1;
    const longestStreak = Math.max(newStreak, existing.longest_streak ?? 0);

    await supabase
      .from('user_stats')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        total_listens: (existing.total_listens ?? 0) + 1,
        last_listen_date: today,
      })
      .eq('id', existing.id);
  } catch (e) {
    console.error('updateStreak', e);
  }
}

export async function getUserStats(userId: string) {
  const { data } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}
