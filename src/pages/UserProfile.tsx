import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { ArrowLeft, Repeat2, Flame, Music2, UserPlus, UserCheck, Trophy, Ban, ShieldCheck } from 'lucide-react';
import { avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { getUserStats } from '@/lib/streaks';
import { getRankProgress, type RankProgress } from '@/lib/ranks';
import RankBadge from '@/components/RankBadge';
import ProfileBadge from '@/components/ProfileBadge';
import PinnedTrack from '@/components/PinnedTrack';
import { cn } from '@/lib/utils';
import type { Profile, Song } from '@/types/music';

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.title || '', author: r.author || '', audio: r.audio || '',
    cover: r.cover || null, audio_url: r.audio_url || '',
    cover_url: r.cover_url || null, video_url: r.video_url || null, genre: r.genre || null,
    uploaded_by: r.uploaded_by || '', duration: r.duration || 0, play_count: r.play_count ?? 0,
    weekly_play_count: r.weekly_play_count ?? 0, likes_count: r.likes_count ?? 0,
    created_at: r.created, updated_at: r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

type Tab = 'tracks' | 'reposts';

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, profile: viewerProfile } = useAuth();
  const { playSongFromList } = usePlayer();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>([]);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [rank, setRank] = useState<RankProgress | null>(null);
  const [repostedSongs, setRepostedSongs] = useState<Song[]>([]);
  const [tab, setTab] = useState<Tab>('tracks');

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const pRecord = await pbGetFirst('profiles', `user_id = "${userId}"`);
      setProfile(pRecord ? { id: pRecord.id, user_id: pRecord.user_id, pseudo: pRecord.pseudo, first_name: pRecord.first_name, last_name: pRecord.last_name, avatar: pRecord.avatar ?? null, avatar_url: pRecord.avatar_url ?? null, bio: pRecord.bio, badge: pRecord.badge ?? null, ban_status: pRecord.ban_status ?? false, profile_completed: pRecord.profile_completed, pinned_song_id: pRecord.pinned_song_id ?? null, pinned_start: pRecord.pinned_start ?? null, pinned_end: pRecord.pinned_end ?? null, collectionName: pRecord.collectionName, collectionId: pRecord.collectionId, created_at: pRecord.created, updated_at: pRecord.updated } : null);

      const [songRes, fers, fing, statsData, rankData, repostsRes] = await Promise.all([
        pb.collection('songs').getList(1, 100, { filter: `uploaded_by = "${userId}"`, sort: '-created', requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `following_id = "${userId}" && status = "accepted"`, requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `follower_id = "${userId}" && status = "accepted"`, requestKey: null }),
        getUserStats(userId),
        getRankProgress(userId),
        pb.collection('repost').getList(1, 50, { filter: `user_id = "${userId}"`, sort: '-created', requestKey: null }),
      ]);

      setSongs(songRes.items.map(recordToSong));
      setCounts({ followers: fers.totalItems, following: fing.totalItems });
      setStreak((statsData as any)?.current_streak ?? 0);
      setLongestStreak((statsData as any)?.longest_streak ?? 0);
      setRank(rankData);

      if (repostsRes.items.length > 0) {
        const ids = [...new Set(repostsRes.items.map((r: any) => r.song_id))].filter(Boolean) as string[];
        const filter = ids.map((id) => `id = "${id}"`).join(' || ');
        const rSongs = await pb.collection('songs').getList(1, 50, { filter, requestKey: null });
        setRepostedSongs(rSongs.items.map(recordToSong));
      } else {
        setRepostedSongs([]);
      }

      if (user && user.id !== userId) {
        const fRecord = await pbGetFirst('follows', `follower_id = "${user.id}" && following_id = "${userId}"`);
        setFollowStatus(fRecord?.status || 'none');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId, user]);

  const follow = async () => {
    if (!user || !userId) return;
    try {
      await pb.collection('follows').create({ follower_id: user.id, following_id: userId, status: 'accepted' });

      // Fetch sender's own profile directly from DB — never use email as fallback
      let pseudo = '';
      let senderAvatarUrl = '';
      try {
        const p = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`, { requestKey: null });
        pseudo = (p.pseudo as string | null)?.trim() ?? '';
        senderAvatarUrl = avatarUrl(p);
      } catch { /* profile not found */ }

      await pb.collection('notifications').create({
        recipient_id: userId,
        type: 'friend_request',
        title: 'Nouvel abonné',
        body: pseudo ? `${pseudo} a commencé à vous suivre` : 'Quelqu\'un a commencé à vous suivre',
        data: { sender_id: user.id, sender_pseudo: pseudo || null, sender_avatar: senderAvatarUrl || null },
      });
      setFollowStatus('accepted');
      setCounts((c) => ({ ...c, followers: c.followers + 1 }));
    } catch (e: any) { toast.error(e.message); }
  };

  const unfollow = async () => {
    if (!user || !userId) return;
    const fRecord = await pbGetFirst('follows', `follower_id = "${user.id}" && following_id = "${userId}"`);
    if (fRecord) await pb.collection('follows').delete(fRecord.id);
    setFollowStatus('none');
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
  };

  const toggleBan = async () => {
    if (!profile) return;
    const next = !profile.ban_status;
    try {
      await pb.collection('profiles').update(profile.id, { ban_status: next });
      setProfile((p) => (p ? { ...p, ban_status: next } : p));
      toast.success(next ? 'Utilisateur banni' : 'Utilisateur débanni');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  if (loading && !profile) {
    return (
      <div className="relative min-h-screen pb-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />
        <div className="relative flex flex-col items-center px-5 pt-6">
          <div className="mb-6 h-9 w-9 self-start animate-pulse rounded-full bg-secondary" />
          <div className="h-28 w-28 animate-pulse rounded-full bg-secondary" />
          <div className="mt-4 h-5 w-32 animate-pulse rounded bg-secondary" />
          <div className="mt-2 h-3 w-48 animate-pulse rounded bg-secondary" />
          <div className="mt-6 h-16 w-full animate-pulse rounded-2xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">Ce profil est introuvable.</p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />Retour
        </Button>
      </div>
    );
  }

  const isMe = user?.id === profile.user_id;
  const displayStreak = streak >= 3 ? streak : longestStreak >= 3 ? longestStreak : 0;
  const streakActive = streak >= 3;

  const tabs: { id: Tab; label: string; icon: typeof Music2; count: number }[] = [
    { id: 'tracks', label: 'Morceaux', icon: Music2, count: songs.length },
    { id: 'reposts', label: 'Reposts', icon: Repeat2, count: repostedSongs.length },
  ];

  return (
    <div className="relative min-h-screen pb-32">
      {/* Halo héro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header ── */}
      <header className="relative flex items-center justify-between px-5 pt-6 animate-fade-slide-up">
        <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-bold">{profile.pseudo || 'Profil'}</h1>
        <div className="w-9" />
      </header>

      {/* ── Identité ── */}
      <section className="relative flex flex-col items-center px-5 pt-4 text-center animate-fade-slide-up delay-1">
        <div className="relative">
          <div className="rounded-full bg-gradient-primary p-[3px] shadow-elegant-sm">
            <Avatar className="h-28 w-28 border-[3px] border-background">
              <AvatarImage src={avatarUrl(profile)} />
              <AvatarFallback className="text-3xl font-bold">{profile.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
          </div>
          {displayStreak > 0 && (
            <div className={cn(
              'absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-background px-2 py-0.5 shadow-soft border border-border/60',
              streakActive ? 'text-orange-400' : 'text-muted-foreground'
            )}>
              <Flame className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">{displayStreak}</span>
            </div>
          )}
        </div>

        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{profile.pseudo || 'Utilisateur'}</h2>
        {rank && <RankBadge tier={rank.tier} size="md" className="mt-2" />}
        {profile.badge && <ProfileBadge label={profile.badge} size="md" className="mt-2" />}
        {profile.bio && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>}

        {/* Stats */}
        <div className="mt-5 grid w-full grid-cols-3 overflow-hidden rounded-2xl border border-border/50 bg-card/50">
          {[
            { value: songs.length, label: 'Sons' },
            { value: counts.followers, label: 'Abonnés' },
            { value: counts.following, label: 'Suivis' },
          ].map((s, i) => (
            <div key={s.label} className={cn('flex flex-col items-center justify-center py-3', i > 0 && 'border-l border-border/50')}>
              <span className="text-lg font-extrabold leading-none">{s.value}</span>
              <span className="mt-1 text-[10px] font-medium text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Follow */}
        {!isMe && user && (
          <div className="mt-4 w-full">
            {followStatus === 'accepted' ? (
              <Button variant="outline" className="w-full rounded-xl font-semibold" onClick={unfollow}>
                <UserCheck className="mr-1.5 h-4 w-4" />Abonné
              </Button>
            ) : (
              <Button className="w-full rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm" onClick={follow}>
                <UserPlus className="mr-1.5 h-4 w-4" />Suivre
              </Button>
            )}
          </div>
        )}

        {/* Bannir / Débannir — réservé aux membres avec le badge PDG, sur les profils sans badge */}
        {!isMe && viewerProfile?.badge && !profile.badge && (
          <div className="mt-2 w-full">
            {profile.ban_status ? (
              <Button variant="outline" className="w-full rounded-xl font-semibold" onClick={toggleBan}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />Débannir
              </Button>
            ) : (
              <Button variant="destructive" className="w-full rounded-xl font-semibold" onClick={toggleBan}>
                <Ban className="mr-1.5 h-4 w-4" />Bannir
              </Button>
            )}
          </div>
        )}

        {/* Titre épinglé */}
        {profile.pinned_song_id && (
          <div className="mt-4 w-full text-left">
            <PinnedTrack songId={profile.pinned_song_id} start={profile.pinned_start ?? 0} />
          </div>
        )}
      </section>

      {/* ── Rang ── */}
      {rank && (
        <section className="relative px-5 mt-6 animate-fade-slide-up delay-2">
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
            <Trophy className="h-5 w-5 text-primary" />Rang
          </h3>
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-4">
            <div
              className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl', rank.tier.ultimate && 'animate-pulse')}
              style={{ backgroundColor: `${rank.tier.color}26`, border: `2px solid ${rank.tier.color}` }}
            >
              {rank.tier.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: rank.tier.color }}>{rank.tier.label}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">Palier {rank.tier.index}/30</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(rank.questsDone / rank.totalQuests) * 100}%`, backgroundColor: rank.tier.color }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {rank.questsDone}/{rank.totalQuests} quêtes accomplies
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Contenu : onglets ── */}
      <section className="relative px-5 mt-6 animate-fade-slide-up delay-3">
        <div className="mb-4 flex rounded-2xl border border-border/50 bg-card/50 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors',
                tab === t.id ? 'bg-gradient-primary text-primary-foreground shadow-elegant-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count > 0 && (
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold', tab === t.id ? 'bg-white/20' : 'bg-secondary')}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'tracks' ? (
          songs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {songs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />))}
            </div>
          ) : (
            <EmptyState icon={<Music2 className="h-6 w-6 text-primary" />} title="Aucun morceau" subtitle="Cet artiste n'a encore rien publié." />
          )
        ) : repostedSongs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {repostedSongs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, repostedSongs)} />))}
          </div>
        ) : (
          <EmptyState icon={<Repeat2 className="h-6 w-6 text-primary" />} title="Aucune republication" subtitle="Les sons repostés apparaîtront ici." />
        )}
      </section>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">{icon}</div>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
