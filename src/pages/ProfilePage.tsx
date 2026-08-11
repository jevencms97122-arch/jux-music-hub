import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { getLocalTracks, deleteLocalTrack } from '@/lib/offlineLibrary';
import { toast } from 'sonner';
import { useSeo } from '@/lib/useSeo';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Pencil, Sparkles, Trophy, Music2, Settings, PlusCircle, History,
  Flame, Repeat2, QrCode, ChevronRight, Headphones, ListMusic,
  Mic2, Play, Bell, LogOut, Info, Heart,
} from 'lucide-react';
import { useLazySection } from '@/hooks/useLazySection';
import { avatarUrl, songCoverUrl } from '@/lib/storage';
import CachedImage from '@/components/CachedImage';
import { useEffect, useState } from 'react';
import { getRankProgress, type RankProgress } from '@/lib/ranks';
import RankBadge from '@/components/RankBadge';
import ProfileBadge from '@/components/ProfileBadge';
import { getUserStats } from '@/lib/streaks';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import NativeAppSettings from '@/components/NativeAppSettings';
import type { Song } from '@/types/music';
import { recordToSong } from '@/lib/pbUtils';
import PinnedTrack from '@/components/PinnedTrack';
import ProfileQrCode from '@/components/ProfileQrCode';
import SettingsSheet from '@/components/SettingsSheet';
import AppInfoSheet from '@/components/AppInfoSheet';
import DonationSheet from '@/components/DonationSheet';
import TabFade from '@/components/TabFade';
import { cn } from '@/lib/utils';


type Tab = 'tracks' | 'reposts' | 'history';

export default function ProfilePage() {
  useSeo({ title: 'Profil — Nexora Music', description: 'Ton profil Nexora Music.', path: '/profile' });
  const { profile, user, logout } = useAuth();
  const { offline } = useOfflineMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { playSongFromList } = usePlayer();

  const [rank, setRank] = useState<RankProgress | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [streak, setStreak] = useState(0);
  const [totalListens, setTotalListens] = useState(0);
  const [recentHistory, setRecentHistory] = useState<{ song: Song; listenedAt: string }[]>([]);
  const [repostedSongs, setRepostedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('tracks');
  const [repostsLoaded, setRepostsLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [favoriteArtists, setFavoriteArtists] = useState<{ name: string; totalPlays: number; songs: Song[] }[]>([]);
  const [favoriteArtistsLoading, setFavoriteArtistsLoading] = useState(true);
  const artistsLazy = useLazySection();

  useEffect(() => {
    if (offline) {
      setLoading(true);
      getLocalTracks().then(setSongs).finally(() => setLoading(false));
      setFavoriteArtistsLoading(false);
      return;
    }
    if (!user) return;
    setSongs([]);
    setLoading(true);

    getRankProgress(user.id).then(setRank);
    getUserStats(user.id).then((s: any) => {
      setStreak(s?.current_streak ?? 0);
      setTotalListens(s?.total_listens ?? 0);
    });

    setRepostsLoaded(false);
    setHistoryLoaded(false);
    (async () => {
      try {
        const [songRes, followersRes, followingRes] = await Promise.all([
          pb.collection('songs').getList(1, 100, { filter: `uploaded_by = "${user.id}"`, sort: '-created', requestKey: null }),
          pb.collection('follows').getList(1, 1, { filter: `following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
          pb.collection('follows').getList(1, 1, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null }),
        ]);
        setSongs(songRes.items.map(recordToSong));
        setCounts({ followers: followersRes.totalItems, following: followingRes.totalItems });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, location.pathname, offline]);

  // Reposts — chargés seulement quand l'onglet est ouvert (lazy)
  useEffect(() => {
    if (offline || !user || tab !== 'reposts' || repostsLoaded) return;
    setRepostsLoaded(true);
    (async () => {
      try {
        const repostsRes = await pb.collection('repost').getList(1, 50, { filter: `user_id = "${user.id}"`, sort: '-created', requestKey: null });
        if (repostsRes.items.length > 0) {
          const repostSongIds = [...new Set(repostsRes.items.map((r: any) => r.song_id))].filter(Boolean) as string[];
          const filter = repostSongIds.map((id) => `id = "${id}"`).join(' || ');
          const rSongs = await pb.collection('songs').getList(1, 50, { filter, requestKey: null });
          setRepostedSongs(rSongs.items.map(recordToSong));
        } else {
          setRepostedSongs([]);
        }
      } catch {}
    })();
  }, [offline, user, tab, repostsLoaded]);

  // Historique récent — chargé seulement quand l'onglet est ouvert (lazy)
  useEffect(() => {
    if (offline || !user || tab !== 'history' || historyLoaded) return;
    setHistoryLoaded(true);
    (async () => {
      try {
        const historyRes = await pb.collection('listen_history').getList(1, 10, { filter: `user_id = "${user.id}"`, sort: '-listened_at', requestKey: null });
        if (historyRes.items.length > 0) {
          const songIds = [...new Set(historyRes.items.map((r: any) => r.song_id))].filter(Boolean) as string[];
          const songMap: Record<string, Song> = {};
          if (songIds.length > 0) {
            const filters = songIds.map((sid) => `id = "${sid}"`).join(' || ');
            const songRes2 = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
            for (const r of songRes2.items) songMap[r.id] = recordToSong(r);
          }
          setRecentHistory(
            historyRes.items
              .filter((r: any) => songMap[r.song_id])
              .map((r: any) => ({ song: songMap[r.song_id], listenedAt: r.listened_at }))
          );
        } else {
          setRecentHistory([]);
        }
      } catch {}
    })();
  }, [offline, user, tab, historyLoaded]);

  // Artistes favoris — dérivés de l'historique d'écoute réel de l'utilisateur (lazy)
  useEffect(() => {
    if (offline || !user || !artistsLazy.visible) return;
    (async () => {
      try {
        const hist = await pb.collection('listen_history').getList(1, 200, {
          filter: `user_id = "${user.id}"`,
          sort: '-listened_at',
          requestKey: null,
        });
        const songIds = [...new Set(hist.items.map((h: any) => h.song_id))] as string[];
        if (songIds.length === 0) { setFavoriteArtistsLoading(false); return; }
        const filter = songIds.map((id) => `id = "${id}"`).join(' || ');
        const songsRes = await pb.collection('songs').getList(1, 200, { filter, requestKey: null });
        const songMap: Record<string, Song> = Object.fromEntries(songsRes.items.map((r: any) => [r.id, recordToSong(r)]));

        const map: Record<string, { name: string; totalPlays: number; songs: Song[] }> = {};
        for (const h of hist.items as any[]) {
          const song = songMap[h.song_id];
          const name = song?.author?.trim();
          if (!song || !name) continue;
          if (!map[name]) map[name] = { name, totalPlays: 0, songs: [] };
          map[name].totalPlays += 1;
          if (!map[name].songs.some((s) => s.id === song.id)) map[name].songs.push(song);
        }
        setFavoriteArtists(Object.values(map).sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 5));
      } catch {}
      setFavoriteArtistsLoading(false);
    })();
  }, [offline, user, artistsLazy.visible]);

  const handleDeleteLocalTrack = async (songId: string) => {
    if (!window.confirm('Supprimer ce son de ta bibliothèque hors ligne ?')) return;
    try {
      await deleteLocalTrack(songId);
      setSongs((prev) => prev.filter((s) => s.id !== songId));
      toast.success('Son supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Music2; count: number }[] = [
    { id: 'tracks', label: 'Morceaux', icon: Music2, count: songs.length },
    { id: 'reposts', label: 'Reposts', icon: Repeat2, count: repostedSongs.length },
    { id: 'history', label: 'Récents', icon: History, count: recentHistory.length },
  ];

  return (
    <div className="relative min-h-screen pb-32">
      {/* Halo héro en haut de page */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header / Identité ── */}
      <header className="relative px-5 pt-6 animate-fade-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight">Profil</h1>
          <div className="flex items-center gap-1">
            <ProfileQrCode
              trigger={
                <Button size="icon" variant="ghost" aria-label="Partager mon profil" className="text-muted-foreground hover:text-foreground">
                  <QrCode className="h-5 w-5" />
                </Button>
              }
            />
            <SettingsSheet
              trigger={
                <Button size="icon" variant="ghost" aria-label="Paramètres" className="text-muted-foreground hover:text-foreground">
                  <Settings className="h-5 w-5" />
                </Button>
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Avatar avec anneau dégradé */}
          <div className="relative shrink-0">
            <div className="rounded-full bg-gradient-primary p-[3px] shadow-elegant-sm">
              <Avatar className="h-[88px] w-[88px] border-[3px] border-background">
                <AvatarImage src={profile ? avatarUrl(profile) : ''} />
                <AvatarFallback className="text-2xl font-bold">{profile?.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
            </div>
            {streak >= 3 && (
              <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-background px-2 py-0.5 shadow-soft border border-border/60">
                <Flame className="h-3.5 w-3.5 text-orange-400 animate-flame" />
                <span className="text-xs font-bold text-orange-400">{streak}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid flex-1 grid-cols-3 overflow-hidden rounded-2xl border border-border/50 bg-card/50">
            {[
              { value: songs.length, label: 'Sons' },
              { value: counts.followers, label: 'Abonnés' },
              { value: counts.following, label: 'Suivis' },
            ].map((s, i) => (
              <button
                key={s.label}
                onClick={() => navigate('/social')}
                className={cn(
                  'flex flex-col items-center justify-center py-3 transition-colors hover:bg-card',
                  i > 0 && 'border-l border-border/50'
                )}
              >
                <span className="text-lg font-extrabold leading-none">{loading ? '–' : s.value}</span>
                <span className="mt-1 text-[10px] font-medium text-muted-foreground">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h2 className={cn('text-xl font-bold leading-tight', profile?.badge?.includes('PDG') && 'text-pdg-gold')}>
              {profile?.pseudo ?? 'Utilisateur'}
            </h2>
            {rank && <RankBadge tier={rank.tier} />}
          </div>
          {profile?.badge && <ProfileBadge label={profile.badge} className="mt-1.5" />}
          {profile?.bio && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1 rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm" onClick={() => navigate('/profile-edit')}>
            <Pencil className="mr-1.5 h-4 w-4" />Modifier
          </Button>
          {(offline || profile?.badge) && (
            <Button size="sm" variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => navigate('/upload')}>
              <PlusCircle className="mr-1.5 h-4 w-4" />{offline ? 'Ajouter un son' : 'Publier'}
            </Button>
          )}
        </div>
      </header>

      {/* ── Titre épinglé ── */}
      {profile?.pinned_song_id && (
        <section className="relative px-5 mt-5 animate-fade-slide-up delay-1">
          <PinnedTrack songId={profile.pinned_song_id} start={profile.pinned_start ?? 0} />
        </section>
      )}

      {/* ── Stats d'écoute + Wrapped ── */}
      <section className="relative px-5 mt-5 animate-fade-slide-up delay-2">
        {(streak > 0 || totalListens > 0) && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-400/15">
                <Flame className="h-5 w-5 text-orange-400 animate-flame" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-none">{streak}</div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">Jours de série</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-none">{totalListens}</div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">Écoutes totales</div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/wrapped')}
          className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-primary p-4 text-left shadow-elegant-sm transition-transform active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-primary-foreground">Mon Wrapped</div>
            <div className="text-[11px] text-primary-foreground/75">Découvre tes stats d'écoute</div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-primary-foreground/70 transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

      {/* ── Rang & Quêtes ── */}
      {rank && (
        <section className="relative px-5 mt-6 animate-fade-slide-up delay-3">
          <button
            onClick={() => navigate('/rank')}
            className="group flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 text-left transition-colors hover:bg-card active:scale-[0.98]"
          >
            <div
              className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl', rank.tier.ultimate && 'animate-pulse')}
              style={{ backgroundColor: `${rank.tier.color}26`, border: `2px solid ${rank.tier.color}` }}
            >
              {rank.tier.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold" style={{ color: rank.tier.color }}>{rank.tier.label}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">Palier {rank.tier.index}/30</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(rank.questsDone / rank.totalQuests) * 100}%`, backgroundColor: rank.tier.color }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {rank.questsDone}/{rank.totalQuests} quêtes accomplies
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </section>
      )}

      {/* ── Artistes favoris (dérivés de l'historique d'écoute réel) ── */}
      {!offline && (
        <div ref={artistsLazy.ref}>
          {favoriteArtistsLoading && artistsLazy.visible ? (
            <section className="relative px-5 mt-6">
              <div className="mb-4 h-5 w-32 animate-pulse rounded bg-secondary" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="h-16 w-16 animate-pulse rounded-full bg-secondary" />
                    <div className="h-2.5 w-12 animate-pulse rounded bg-secondary" />
                  </div>
                ))}
              </div>
            </section>
          ) : favoriteArtists.length > 0 && (
            <section className="relative px-5 mt-6 animate-fade-slide-up">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mic2 className="h-4 w-4 text-primary" strokeWidth={2} />
                  <h2 className="text-base font-bold tracking-tight text-foreground">Artistes Favoris</h2>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                {favoriteArtists.map((artist) => {
                  const coverSong = artist.songs.find((s) => s.cover_url) ?? artist.songs[0];
                  const cover = coverSong ? songCoverUrl(coverSong) : null;
                  return (
                    <button
                      key={artist.name}
                      onClick={() => playSongFromList(artist.songs[0], artist.songs)}
                      className="group flex w-20 shrink-0 flex-col items-center gap-2"
                    >
                      <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary">
                        {cover ? (
                          <CachedImage src={cover} alt={artist.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Mic2 className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
                          <Play className="h-5 w-5 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>
                      <p className="w-full truncate text-center text-xs font-semibold text-foreground group-hover:text-primary">{artist.name}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Contenu : onglets ── */}
      <section className="relative px-5 mt-6 animate-fade-slide-up delay-4">
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
                <span className={cn(
                  'rounded-full px-1.5 text-[10px] font-bold',
                  tab === t.id ? 'bg-white/20' : 'bg-secondary'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-square w-full animate-pulse rounded-xl bg-secondary" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : (
        <TabFade tabKey={tab}>
        {tab === 'tracks' ? (
          songs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {songs.map((s, i) => (
                <SongCard
                  key={s.id}
                  song={s}
                  index={i}
                  onPlay={() => playSongFromList(s, songs)}
                  onDelete={offline ? () => handleDeleteLocalTrack(s.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Music2 className="h-6 w-6 text-primary" />}
              title="Aucun morceau"
              subtitle={offline ? "Ajoute un son depuis tes fichiers pour le voir ici." : profile?.badge ? "Publie ton premier son pour le voir ici." : "Seuls les membres avec le badge PDG de Jux Music peuvent publier."}
              action={(offline || profile?.badge) ? <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => navigate('/upload')}><PlusCircle className="mr-1.5 h-4 w-4" />{offline ? 'Ajouter un son' : 'Publier un son'}</Button> : undefined}
            />
          )
        ) : tab === 'reposts' ? (
          repostedSongs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {repostedSongs.map((s, i) => (<SongCard key={s.id} song={s} index={i} onPlay={() => playSongFromList(s, repostedSongs)} />))}
            </div>
          ) : (
            <EmptyState
              icon={<Repeat2 className="h-6 w-6 text-primary" />}
              title="Aucune republication"
              subtitle="Reposte les sons que tu aimes pour les partager."
            />
          )
        ) : recentHistory.length > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button onClick={() => navigate('/favorites')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ListMusic className="h-3.5 w-3.5" /> Mes favoris
              </button>
            </div>
            {recentHistory.map(({ song, listenedAt }, i) => (
              <button
                key={`${song.id}-${i}`}
                onClick={() => playSongFromList(song, recentHistory.map((h) => h.song))}
                className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-2 text-left transition-colors hover:bg-card"
              >
                <CachedImage src={songCoverUrl(song)} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{song.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{song.author}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(listenedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<History className="h-6 w-6 text-primary" />}
            title="Aucune écoute récente"
            subtitle="Ton historique d'écoute apparaîtra ici."
          />
        )}
        </TabFade>
        )}
      </section>

      {/* ── Paramètres du compte ── */}
      <section className="relative px-5 mt-8 animate-fade-slide-up">
        <h2 className="mb-3 border-b border-border/50 pb-3 text-sm font-bold text-primary">Paramètres du Compte</h2>
        <div className="space-y-1">
          <SettingsSheet
            trigger={
              <button className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-card/60">
                <div className="flex items-center gap-3">
                  <Settings className="h-4.5 w-4.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="text-sm font-medium text-foreground">Paramètres généraux</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            }
          />
          <button
            onClick={() => navigate('/notifications')}
            className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-card/60"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-4.5 w-4.5 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="text-sm font-medium text-foreground">Notifications</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span className="text-sm font-medium">Déconnexion</span>
          </button>
          <AppInfoSheet
            trigger={
              <button className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-card/60">
                <div className="flex items-center gap-3">
                  <Info className="h-4.5 w-4.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  <span className="text-sm font-medium text-foreground">Informations de l'application</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            }
          />
          <DonationSheet
            trigger={
              <button className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-card/60">
                <div className="flex items-center gap-3">
                  <Heart className="h-4.5 w-4.5 text-rose-400 transition-colors" />
                  <span className="text-sm font-medium text-foreground">Faire un don</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            }
          />
        </div>
      </section>

      <NativeAppSettings />
    </div>
  );
}

function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">{icon}</div>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
