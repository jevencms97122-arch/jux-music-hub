import { pb } from './pocketbase';

export interface Quest {
  id: string;
  name: string;
  description: string;
  emoji: string;
  value: number;
  target: number;
  done: boolean;
}

export interface RankTier {
  /** Palier 1 → 30 */
  index: number;
  /** Nom du rang (ex: "Virtuose") */
  name: string;
  /** Niveau dans le rang (1 → 5), 0 pour le palier ultime */
  level: number;
  /** Libellé complet (ex: "Virtuose III") */
  label: string;
  emoji: string;
  /** Couleur hex du rang, utilisée en style inline */
  color: string;
  ultimate: boolean;
  /** Nombre de quêtes accomplies requises pour ce palier */
  questsRequired: number;
}

export interface RankProgress {
  quests: Quest[];
  questsDone: number;
  totalQuests: number;
  tier: RankTier;
  nextTier: RankTier | null;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const RANK_DEFS: { name: string; emoji: string; color: string; levels: number; ultimate?: boolean }[] = [
  { name: 'Amateur', emoji: '🎵', color: '#94a3b8', levels: 5 },
  { name: 'Mélomane', emoji: '🎧', color: '#34d399', levels: 4 },
  { name: 'Artiste', emoji: '🎤', color: '#38bdf8', levels: 4 },
  { name: 'Virtuose', emoji: '🎸', color: '#a78bfa', levels: 4 },
  { name: 'Maestro', emoji: '🎼', color: '#fb923c', levels: 4 },
  { name: 'Légende', emoji: '🌟', color: '#facc15', levels: 4 },
  { name: 'Icône', emoji: '💎', color: '#f472b6', levels: 4 },
  { name: 'Panthéon Jux', emoji: '👑', color: '#fbbf24', levels: 1, ultimate: true },
];

export const TOTAL_QUESTS = 26;

/**
 * Les 30 paliers : Amateur I → Panthéon Jux.
 * Les seuils sont répartis proportionnellement sur les quêtes : le palier 1 est offert,
 * le palier 30 (ultime) requiert toutes les quêtes.
 */
export const RANK_TIERS: RankTier[] = RANK_DEFS.flatMap((rank) =>
  Array.from({ length: rank.levels }, (_, i) => ({
    name: rank.name,
    level: rank.ultimate ? 0 : i + 1,
    label: rank.ultimate ? rank.name : `${rank.name} ${ROMAN[i]}`,
    emoji: rank.emoji,
    color: rank.color,
    ultimate: !!rank.ultimate,
    index: 0,
    questsRequired: 0,
  }))
).map((tier, i, arr) => ({
  ...tier,
  index: i + 1,
  questsRequired: Math.round((i * TOTAL_QUESTS) / (arr.length - 1)),
}));

export function tierForQuestCount(done: number): RankTier {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (t.questsRequired <= done) tier = t;
    else break;
  }
  return tier;
}

/**
 * Calcule les quêtes et le palier d'un utilisateur.
 * Calculs côté client basés sur les données publiques.
 */
export async function getRankProgress(userId: string): Promise<RankProgress | null> {
  try {
    const count = (collection: string, filter: string) =>
      pb.collection(collection).getList(1, 1, { filter, requestKey: null }).then((r) => r.totalItems).catch(() => 0);

    const [statsRes, songsRes, following, likes, playlists, comments, reposts, stories] = await Promise.all([
      pb.collection('user_stats').getList(1, 1, { filter: `user_id = "${userId}"`, requestKey: null }).then((r) => r.items[0]).catch(() => null),
      pb.collection('songs').getList(1, 200, { filter: `uploaded_by = "${userId}"`, requestKey: null }).then((r) => r.items as any[]).catch(() => [] as any[]),
      count('follows', `follower_id = "${userId}" && status = "accepted"`),
      count('song_likes', `user_id = "${userId}"`),
      count('playlists', `owner_id = "${userId}"`),
      count('song_comments', `user_id = "${userId}"`),
      count('repost', `user_id = "${userId}"`),
      count('stories', `user_id = "${userId}"`),
    ]);

    const uploads = songsRes.length;
    const uploadPlays = songsRes.reduce((s: number, u: any) => s + (u.play_count ?? 0), 0);
    const longestStreak = (statsRes as any)?.longest_streak ?? 0;
    const totalListens = (statsRes as any)?.total_listens ?? 0;

    const q = (id: string, name: string, description: string, emoji: string, value: number, target: number): Quest =>
      ({ id, name, description, emoji, value: Math.min(value, target), target, done: value >= target });

    const quests: Quest[] = [
      // Création
      q('first-upload', 'Premier morceau', 'Publie ton premier titre', '🎵', uploads, 1),
      q('creator', 'Créateur', 'Publie 10 morceaux', '🎙️', uploads, 10),
      q('prolific', 'Machine à sons', 'Publie 25 morceaux', '📀', uploads, 25),
      q('viral', 'Viral', '100 écoutes cumulées sur tes sons', '🚀', uploadPlays, 100),
      q('star', 'Étoile montante', '1 000 écoutes cumulées sur tes sons', '⭐', uploadPlays, 1000),
      q('hit-maker', 'Hit-maker', '10 000 écoutes cumulées sur tes sons', '🏆', uploadPlays, 10000),
      // Série
      q('streak-3', 'Régularité', "3 jours d'écoute consécutifs", '🔥', longestStreak, 3),
      q('streak-7', 'Une semaine', "7 jours d'écoute consécutifs", '🔥', longestStreak, 7),
      q('streak-30', 'Inarrêtable', "30 jours d'écoute consécutifs", '⚡', longestStreak, 30),
      q('streak-100', 'Centurion', "100 jours d'écoute consécutifs", '☄️', longestStreak, 100),
      // Écoute
      q('first-listen', 'Première écoute', 'Écoute ton premier son', '▶️', totalListens, 1),
      q('listener-100', 'Auditeur assidu', '100 écoutes au total', '🎧', totalListens, 100),
      q('listener-1000', 'Audiophile', '1 000 écoutes au total', '🔊', totalListens, 1000),
      q('listener-5000', 'Oreille absolue', '5 000 écoutes au total', '👂', totalListens, 5000),
      // Likes
      q('first-like', 'Premier crush', 'Aime ton premier morceau', '❤️', likes, 1),
      q('liker-10', 'Coup de cœur', 'Aime 10 morceaux', '💖', likes, 10),
      q('liker-100', 'Grand romantique', 'Aime 100 morceaux', '💘', likes, 100),
      // Playlists
      q('first-playlist', 'Première playlist', 'Crée ta première playlist', '📁', playlists, 1),
      q('curator-5', 'Curateur', 'Crée 5 playlists', '📋', playlists, 5),
      q('curator-15', 'Architecte du son', 'Crée 15 playlists', '🗂️', playlists, 15),
      // Communauté
      q('first-follow', 'Explorateur', 'Suis ta première personne', '🧭', following, 1),
      q('follow-20', 'Connecté', 'Suis 20 personnes', '🤝', following, 20),
      q('first-comment', 'Premier commentaire', 'Commente un morceau', '💬', comments, 1),
      q('commenter-25', 'Critique musical', 'Poste 25 commentaires', '✍️', comments, 25),
      q('first-repost', 'Premier repost', 'Reposte un son', '🔁', reposts, 1),
      q('first-story', 'Storyteller', 'Poste ta première story', '📸', stories, 1),
    ];

    const questsDone = quests.filter((x) => x.done).length;
    const tier = tierForQuestCount(questsDone);
    const nextTier = tier.index < RANK_TIERS.length ? RANK_TIERS[tier.index] : null;

    return { quests, questsDone, totalQuests: quests.length, tier, nextTier };
  } catch (e) {
    console.error('getRankProgress', e);
    return null;
  }
}
