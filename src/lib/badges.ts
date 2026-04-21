import { supabase } from '@/integrations/supabase/client';

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
}

/**
 * Calcule les badges débloqués pour un utilisateur.
 * Calculs côté client basés sur les données publiques.
 */
export async function getBadges(userId: string): Promise<Badge[]> {
  const [statsRes, songsRes, followersRes, likesRes, playlistsRes] = await Promise.all([
    supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('songs').select('id, play_count').eq('uploaded_by', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true })
      .eq('following_id', userId).eq('status', 'accepted'),
    supabase.from('song_likes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('playlists').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
  ]);

  const stats = statsRes.data;
  const uploads = songsRes.data ?? [];
  const totalUploadPlays = uploads.reduce((s, u: any) => s + (u.play_count ?? 0), 0);
  const followersCount = followersRes.count ?? 0;
  const likesCount = likesRes.count ?? 0;
  const playlistsCount = playlistsRes.count ?? 0;
  const currentStreak = stats?.current_streak ?? 0;
  const longestStreak = stats?.longest_streak ?? 0;
  const totalListens = stats?.total_listens ?? 0;

  return [
    { id: 'first-upload', name: 'Premier morceau', emoji: '🎵', description: 'Upload ton premier titre', unlocked: uploads.length >= 1 },
    { id: 'creator', name: 'Créateur', emoji: '🎙️', description: 'Upload 10 morceaux', unlocked: uploads.length >= 10 },
    { id: 'viral', name: 'Viral', emoji: '🚀', description: 'Atteins 100 écoutes sur tes uploads', unlocked: totalUploadPlays >= 100 },
    { id: 'star', name: 'Étoile montante', emoji: '⭐', description: 'Atteins 1 000 écoutes sur tes uploads', unlocked: totalUploadPlays >= 1000 },

    { id: 'streak-3', name: 'Régularité', emoji: '🔥', description: '3 jours d\'écoute consécutifs', unlocked: longestStreak >= 3 },
    { id: 'streak-7', name: 'Une semaine', emoji: '🔥', description: '7 jours d\'écoute consécutifs', unlocked: longestStreak >= 7 },
    { id: 'streak-30', name: 'Inarrêtable', emoji: '🌟', description: '30 jours d\'écoute consécutifs', unlocked: longestStreak >= 30 },

    { id: 'listener-100', name: 'Mélomane', emoji: '🎧', description: '100 écoutes au total', unlocked: totalListens >= 100 },
    { id: 'listener-1000', name: 'Audiophile', emoji: '💎', description: '1 000 écoutes au total', unlocked: totalListens >= 1000 },

    { id: 'liker', name: 'Coup de cœur', emoji: '❤️', description: 'Aime 10 morceaux', unlocked: likesCount >= 10 },
    { id: 'curator', name: 'Curateur', emoji: '📋', description: 'Crée 5 playlists', unlocked: playlistsCount >= 5 },

    { id: 'social', name: 'Populaire', emoji: '👥', description: '10 abonnés', unlocked: followersCount >= 10 },
    { id: 'influencer', name: 'Influenceur', emoji: '🌍', description: '100 abonnés', unlocked: followersCount >= 100 },
  ];
}
