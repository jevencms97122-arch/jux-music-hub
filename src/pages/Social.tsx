import { useEffect, useRef, useState, useCallback } from 'react';
import TabFade from '@/components/TabFade';
import SlidingTabIndicator from '@/components/SlidingTabIndicator';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { avatarUrl, songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { Headphones, Users, Search, UserPlus, Check, X, ChevronRight, Trophy, Heart, Music2, Activity, Radio, Copy, LogOut, Send, MessageCircle, User as UserIcon } from 'lucide-react';
import { useUnreadMessages } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import type { Profile, Follow, Song } from '@/types/music';
import { useSeo } from '@/lib/useSeo';
import { recordToSong } from '@/lib/pbUtils';
import { usePlayer, type ListenSessionRow } from '@/contexts/PlayerContext';
import FriendsWeeklyLeaderboard from '@/components/FriendsWeeklyLeaderboard';

interface FriendPresence {
  user: Profile;
  is_listening: boolean;
  current_song_id: string | null;
  current_song_title: string | null;
  current_song_author: string | null;
  current_song_cover_url: string | null;
  last_seen_at: string;
}

function recordToProfile(r: any): Profile {
  return {
    id: r.id, user_id: r.user_id, pseudo: r.pseudo,
    first_name: r.first_name, last_name: r.last_name,
    avatar: r.avatar ?? null, avatar_url: r.avatar_url ?? null, bio: r.bio,
    profile_completed: r.profile_completed, collectionName: r.collectionName, collectionId: r.collectionId,
    created_at: r.created, updated_at: r.updated,
  } as Profile;
}

type Tab = 'friends' | 'activity' | 'score';

interface ActivityItem {
  id: string;
  type: 'like' | 'upload';
  userId: string;
  pseudo: string;
  profileAvatarUrl: string;
  song: Song;
  date: string;
}

export default function Social() {
  useSeo({ title: 'Social — Nexora Music', description: 'Suis tes amis, découvre leurs écoutes en direct et leur activité musicale sur Nexora Music.', path: '/social' });

  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { activeSession, isSessionHost, setActiveSession, joinSession, refreshSession, stopAudio } = usePlayer();
  const isPermanentActiveSession = !!activeSession?.is_open;
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<(Follow & { profile?: Profile })[]>([]);
  const [presences, setPresences] = useState<Map<string, FriendPresence>>(new Map());
  const [tab, setTab] = useState<Tab>('friends');
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const activityLoadedRef = useRef(false);

  // Écoute partagée
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [showSessionChoice, setShowSessionChoice] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningSession, setJoiningSession] = useState(false);

  // Messagerie
  const { unreadTotal, unreadBySender } = useUnreadMessages();
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);

  // Requêtes groupées (1 requête par lot de 50 au lieu d'une par utilisateur)
  const fetchProfiles = async (ids: string[]) => {
    if (!ids.length) return [] as Profile[];
    const result: Profile[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const filter = batch.map((uid) => `user_id = "${uid}"`).join(' || ');
      try {
        const res = await pb.collection('profiles').getList(1, 50, { filter, requestKey: null });
        result.push(...res.items.map(recordToProfile));
      } catch {}
    }
    return result;
  };

  const fetchPresences = async (ids: string[]) => {
    if (!ids.length) return [] as any[];
    const result: any[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const filter = batch.map((uid) => `user_id = "${uid}"`).join(' || ');
      try {
        const res = await pb.collection('user_presence').getList(1, 50, { filter, requestKey: null });
        result.push(...res.items);
      } catch {}
    }
    return result;
  };

  const load = async () => {
    if (!user) return;

    const [outF, inF, req] = await Promise.all([
      pb.collection('follows').getList(1, 200, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      pb.collection('follows').getList(1, 200, { filter: `following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      pb.collection('follows').getList(1, 200, { filter: `following_id = "${user.id}" && status = "pending"`, requestKey: null }),
    ]);

    const followingIds = outF.items.map((f: any) => f.following_id);
    const followerIds = inF.items.map((f: any) => f.follower_id);
    const reqItems = req.items.map((r: any) => ({ id: r.id, follower_id: r.follower_id, following_id: r.following_id, status: r.status, created_at: r.created } as Follow));

    const presenceIds = [...followingIds];
    const [presenceProfiles, followerProfiles, reqProfiles, presenceRecords] = await Promise.all([
      fetchProfiles(presenceIds),
      fetchProfiles(followerIds),
      fetchProfiles(reqItems.map((r) => r.follower_id)),
      fetchPresences(presenceIds),
    ]);

    const followingProfiles = presenceProfiles;
    setFollowing(followingProfiles);
    setFollowers(followerProfiles);
    setRequests(reqItems.map((r) => ({ ...r, profile: reqProfiles.find((p) => p.user_id === r.follower_id) })));

    if (presenceRecords.length > 0) {
      setPresences((prev) => {
        const next = new Map(prev);
        for (const pr of presenceRecords) {
          const profile = presenceProfiles.find((fp) => fp.user_id === pr.user_id);
          if (profile) next.set(pr.user_id, { user: profile, is_listening: pr.is_listening, current_song_id: pr.current_song_id, current_song_title: pr.current_song_title, current_song_author: pr.current_song_author, current_song_cover_url: pr.current_song_cover_url, last_seen_at: pr.last_seen_at });
        }
        return next;
      });
    }
    initialLoadDone.current = true;
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  // Polling des présences (groupé en une requête)
  useEffect(() => {
    if (!user || following.length === 0) return;
    const doPoll = async () => {
      const presenceRecords = await fetchPresences(following.map((f) => f.user_id));
      if (presenceRecords.length === 0) return;
      setPresences((prev) => {
        const next = new Map(prev);
        for (const pr of presenceRecords) {
          const existing = next.get(pr.user_id);
          if (existing) next.set(pr.user_id, { ...existing, is_listening: pr.is_listening, current_song_id: pr.current_song_id, current_song_title: pr.current_song_title, current_song_author: pr.current_song_author, current_song_cover_url: pr.current_song_cover_url, last_seen_at: pr.last_seen_at });
        }
        return next;
      });
    };
    const interval = setInterval(doPoll, 8000);
    if (initialLoadDone.current) doPoll();
    return () => clearInterval(interval);
  }, [user, following]);

  const openSession = useCallback(() => {
    if (activeSession) { setShowSessionSheet(true); return; }
    setShowSessionChoice(true);
  }, [activeSession]);

  const createSessionFromSocial = useCallback(async () => {
    if (!user) return;
    setSessionCreating(true);
    try {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      const newS = await pb.collection('listen_sessions').create({
        host_id: user.id, code, is_active: true, is_playing: false,
        position: 0, tempo: 1, participants: [user.id],
      });
      setActiveSession({ id: newS.id, host_id: user.id, song_id: null, position: 0, tempo: 1, is_playing: false, participants: [user.id], is_active: true, code } as ListenSessionRow);
      refreshSession();
      setInvitedIds(new Set());
      setShowSessionChoice(false);
      setShowSessionSheet(true);
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
    setSessionCreating(false);
  }, [user, setActiveSession, refreshSession]);

  const joinSessionByCode = useCallback(async () => {
    if (!user) return;
    const code = joinCodeInput.trim();
    if (!code) return;
    setJoiningSession(true);
    try {
      const res = await pb.collection('listen_sessions').getList(1, 1, {
        filter: `code = "${code}" && is_active = true`,
        requestKey: null,
      });
      const s = res.items[0] as any;
      if (!s) { toast.error('Code invalide'); setJoiningSession(false); return; }
      const participants = (s.participants as string[]) || [];
      const row: ListenSessionRow = { id: s.id, code: s.code ?? null, host_id: s.host_id, song_id: s.song_id ?? null, position: s.position ?? 0, tempo: s.tempo || 1, is_playing: s.is_playing, participants, is_active: true, is_open: s.is_open ?? false };
      const ok = await joinSession(row);
      if (!ok) { toast.error('Impossible de rejoindre la session'); setJoiningSession(false); return; }
      refreshSession();
      setShowJoinDialog(false);
      setShowSessionChoice(false);
      setJoinCodeInput('');
      setShowSessionSheet(true);
      toast.success('Tu as rejoint la session !');
    } catch {
      toast.error('Code invalide');
    }
    setJoiningSession(false);
  }, [user, joinCodeInput, joinSession, refreshSession]);

  const endSessionFromSocial = useCallback(async () => {
    if (!activeSession || !isSessionHost) return;
    try { await pb.collection('listen_sessions').update(activeSession.id, { is_active: false }); stopAudio(); setActiveSession(null); setShowSessionSheet(false); toast.success('Session terminée'); } catch {}
  }, [activeSession, isSessionHost, stopAudio, setActiveSession]);

  const leaveSessionFromSocial = useCallback(async () => {
    if (!activeSession || !user || isSessionHost) return;
    try {
      const participants = (activeSession.participants || []).filter((p) => p !== user.id);
      await pb.collection('listen_sessions').update(activeSession.id, { participants });
      stopAudio();
      setActiveSession(null);
      setShowSessionSheet(false);
      toast.success('Tu as quitté la session');
    } catch {}
  }, [activeSession, user, isSessionHost, stopAudio, setActiveSession]);

  const inviteFriendFromSocial = useCallback(async (friendId: string) => {
    if (!user || !activeSession) return;
    try {
      const senderName = profile?.pseudo || user.email;
      await pb.collection('notifications').create({
        recipient_id: friendId, type: 'session_invite',
        title: `${senderName} t'invite à écouter ensemble`,
        body: `Code : ${activeSession.code}`,
        data: { code: activeSession.code },
      });
      setInvitedIds((prev) => new Set(prev).add(friendId));
      toast.success('Invitation envoyée !');
    } catch { toast.error('Erreur lors de l\'envoi'); }
  }, [user, profile, activeSession]);

  const loadActivityFeed = useCallback(async (followingList: Profile[]) => {
    if (!user || followingList.length === 0) { setActivityFeed([]); return; }
    setActivityLoading(true);
    try {
      const followingIds = followingList.map((f) => f.user_id);

      const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const idFilter = followingIds.map((id) => `user_id = "${id}"`).join(' || ');
      const uploadFilter = followingIds.map((id) => `uploaded_by = "${id}"`).join(' || ');

      const [likesRes, uploadsRes] = await Promise.all([
        pb.collection('song_likes').getList(1, 40, {
          filter: `(${idFilter}) && created >= "${sinceDate}"`,
          sort: '-created',
          requestKey: null,
        }).catch(() => ({ items: [] as any[] })),
        pb.collection('songs').getList(1, 20, {
          filter: `(${uploadFilter}) && created >= "${sinceDate}"`,
          sort: '-created',
          requestKey: null,
        }).catch(() => ({ items: [] as any[] })),
      ]);

      // Résoudre les songs des likes
      const likeSongIds = [...new Set(likesRes.items.map((l: any) => l.song_id as string))];
      let likeSongs: Song[] = [];
      if (likeSongIds.length > 0) {
        for (let i = 0; i < likeSongIds.length; i += 30) {
          const batch = likeSongIds.slice(i, i + 30);
          const f = batch.map((id) => `id = "${id}"`).join(' || ');
          try {
            const res = await pb.collection('songs').getList(1, 30, { filter: f, requestKey: null });
            likeSongs.push(...res.items.map(recordToSong));
          } catch {}
        }
      }
      const songMap = new Map(likeSongs.map((s) => [s.id, s]));

      const profileMap = new Map(followingList.map((p) => [p.user_id, p]));

      const items: ActivityItem[] = [];

      for (const l of likesRes.items) {
        const song = songMap.get(l.song_id);
        const profile = profileMap.get(l.user_id);
        if (!song || !profile) continue;
        items.push({
          id: `like-${l.id}`,
          type: 'like',
          userId: l.user_id,
          pseudo: profile.pseudo || 'Anonyme',
          profileAvatarUrl: avatarUrl(profile as any),
          song,
          date: l.created,
        });
      }

      for (const r of uploadsRes.items) {
        const song = recordToSong(r);
        const profile = profileMap.get(r.uploaded_by);
        if (!profile) continue;
        items.push({
          id: `upload-${r.id}`,
          type: 'upload',
          userId: r.uploaded_by,
          pseudo: profile.pseudo || 'Anonyme',
          profileAvatarUrl: avatarUrl(profile as any),
          song,
          date: r.created,
        });
      }

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivityFeed(items.slice(0, 50));
    } catch {}
    setActivityLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === 'activity' && !activityLoadedRef.current && following.length > 0) {
      activityLoadedRef.current = true;
      loadActivityFeed(following);
    }
  }, [tab, following, loadActivityFeed]);

  const accept = async (id: string) => {
    try { await pb.collection('follows').update(id, { status: 'accepted' }); toast.success('Demande acceptée'); load(); } catch {}
  };
  const reject = async (id: string) => {
    try { await pb.collection('follows').delete(id); load(); } catch {}
  };

  const sortedFollowing = [...following].sort((a, b) => {
    const pa = presences.get(a.user_id); const pb = presences.get(b.user_id);
    if (pa?.is_listening && !pb?.is_listening) return -1;
    if (!pa?.is_listening && pb?.is_listening) return 1;
    return 0;
  });

  const isPresenceFresh = (p: FriendPresence) =>
    p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 45_000;

  const maxInitial = 20;
  const [showAll, setShowAll] = useState(false);
  const displayedFollowing = showAll ? sortedFollowing : sortedFollowing.slice(0, maxInitial);
  const hasMore = sortedFollowing.length > maxInitial;

  const nowPlaying = [...presences.values()].filter((p) => p.is_listening && p.current_song_title && isPresenceFresh(p));

  const tabs: { id: Tab; label: string; icon: typeof Users; badge: number }[] = [
    { id: 'friends', label: 'Amis', icon: Users, badge: requests.length },
    { id: 'activity', label: 'Activité', icon: Activity, badge: 0 },
    { id: 'score', label: 'Score', icon: Trophy, badge: 0 },
  ];

  return (
    <div className="relative min-h-screen pb-40">
      {/* Halo héro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header ── */}
      <header className="relative px-5 pt-6 animate-fade-slide-up">
        <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.02em]">Social</h1>
      </header>

      {/* ── Onglets ── */}
      <div className="relative px-5 mt-4 animate-fade-slide-up delay-1">
        <div className="relative flex rounded-2xl border border-white/[0.06] bg-card/50 p-1 backdrop-blur-md">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors duration-150 active:scale-95',
                tab === t.id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === t.id && <SlidingTabIndicator layoutId="social-tab-indicator" />}
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.badge > 0 && (
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold', tab === t.id ? 'bg-white/20' : 'bg-primary text-primary-foreground')}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <TabFade tabKey={tab} className="relative px-5 mt-5">
      {tab === 'friends' ? (
        <div className="space-y-6">

          {/* ── Nouveaux messages ── */}
          {unreadTotal > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3 backdrop-blur-md">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                <MessageCircle className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-sm font-bold text-primary">
                {unreadTotal} nouveau{unreadTotal > 1 ? 'x' : ''} message{unreadTotal > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* ── Écoute partagée ── */}
          <button
            onClick={openSession}
            disabled={sessionCreating}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border p-4 text-left backdrop-blur-md transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]',
              activeSession
                ? isPermanentActiveSession
                  ? 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15'
                  : 'border-green-500/40 bg-green-500/10 hover:bg-green-500/15'
                : 'border-primary/30 bg-primary/5 hover:bg-primary/10'
            )}
          >
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              activeSession ? (isPermanentActiveSession ? 'bg-orange-500/20' : 'bg-green-500/20') : 'bg-primary/15'
            )}>
              <Radio className={cn('h-5 w-5', activeSession ? (isPermanentActiveSession ? 'text-orange-400' : 'text-green-400') : 'text-primary')} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {activeSession ? (isPermanentActiveSession ? 'Session permanente en cours' : 'Session active') : 'Écouter ensemble'}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeSession
                  ? isPermanentActiveSession
                    ? `${activeSession.participants?.length ?? 1} personne${(activeSession.participants?.length ?? 1) > 1 ? 's' : ''} connectée${(activeSession.participants?.length ?? 1) > 1 ? 's' : ''} · Tap pour gérer`
                    : `Code : ${activeSession.code} · Tap pour gérer`
                  : 'Crée une session et invite tes amis'}
              </p>
            </div>
            {activeSession && (
              <span className={cn('inline-block h-2.5 w-2.5 rounded-full animate-pulse shrink-0', isPermanentActiveSession ? 'bg-orange-500' : 'bg-green-500')} />
            )}
          </button>

          {/* ── Demandes en attente ── */}
          {requests.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
                <UserPlus className="h-4 w-4 text-primary" />
                Demandes
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{requests.length}</span>
              </h2>
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-card/50 p-3 backdrop-blur-md">
                    <Avatar className="h-11 w-11 cursor-pointer transition-transform duration-150 active:scale-90" onClick={() => navigate(`/u/${r.follower_id}`)}>
                      <AvatarImage src={avatarUrl(r.profile as any) || ''} />
                      <AvatarFallback>{r.profile?.pseudo?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <button onClick={() => navigate(`/u/${r.follower_id}`)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold">{r.profile?.pseudo || 'Anonyme'}</p>
                      <p className="text-xs text-muted-foreground">souhaite te suivre</p>
                    </button>
                    <Button size="icon" aria-label="Accepter" className="h-9 w-9 rounded-xl bg-gradient-primary shadow-elegant-sm transition-transform duration-150 active:scale-90" onClick={() => accept(r.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" aria-label="Refuser" variant="outline" className="h-9 w-9 rounded-xl text-muted-foreground transition-transform duration-150 active:scale-90" onClick={() => reject(r.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── En ce moment ── */}
          {nowPlaying.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                En ce moment
              </h2>
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
                {nowPlaying.map((p) => (
                  <button
                    key={p.user.user_id}
                    onClick={() => navigate(`/u/${p.user.user_id}`)}
                    className="relative aspect-square w-36 flex-shrink-0 overflow-hidden rounded-2xl shadow-card ring-1 ring-white/[0.06] transition-transform duration-150 ease-out active:scale-95"
                  >
                    {p.current_song_cover_url
                      ? <img src={p.current_song_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      : <div className="absolute inset-0 bg-gradient-primary" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute left-2 top-2">
                      <div className="relative">
                        <Avatar className="h-8 w-8 ring-2 ring-white/30">
                          <AvatarImage src={avatarUrl(p.user as any)} />
                          <AvatarFallback className="text-xs">{p.user.pseudo?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black bg-green-500" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                      <p className="truncate text-[11px] font-bold leading-tight text-white">{p.current_song_title}</p>
                      <p className="truncate text-[10px] text-white/70">{p.current_song_author}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Amis ── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Users className="h-4 w-4 text-primary" />
              Amis
              {sortedFollowing.length > 0 && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{sortedFollowing.length}</span>
              )}
            </h2>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/30 p-3">
                    <div className="h-12 w-12 animate-pulse rounded-full bg-secondary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-1/3 animate-pulse rounded bg-secondary" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedFollowing.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-bold">Tu ne suis personne</p>
                <p className="text-xs text-muted-foreground">Trouve des amis pour voir ce qu'ils écoutent en direct.</p>
                <Button size="sm" className="mt-3 rounded-xl bg-gradient-primary" onClick={() => navigate('/search')}>
                  <Search className="mr-1.5 h-4 w-4" />Découvrir des profils
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedFollowing.map((f) => {
                  const presence = presences.get(f.user_id);
                  const listening = presence?.is_listening && isPresenceFresh(presence) && presence.current_song_title;
                  const unread = unreadBySender[f.user_id] || 0;
                  return (
                    <button
                      key={f.user_id}
                      onClick={() => setSelectedFriend(f)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-card/50 p-3 text-left backdrop-blur-md transition-[background-color,transform] duration-150 ease-out hover:bg-card active:scale-[0.98]"
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={avatarUrl(f as any)} />
                          <AvatarFallback>{f.pseudo?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        {listening && <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background bg-green-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{f.pseudo || 'Anonyme'}</p>
                        {unread > 0 ? (
                          <p className="flex items-center gap-1 truncate text-xs font-semibold text-primary">
                            <MessageCircle className="h-3 w-3 shrink-0" />
                            {unread} nouveau{unread > 1 ? 'x' : ''} message{unread > 1 ? 's' : ''}
                          </p>
                        ) : listening ? (
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Headphones className="h-3 w-3 shrink-0 text-green-500" />
                            <span className="truncate">{presence!.current_song_title}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Hors ligne</p>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shrink-0">
                          {unread}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
                {hasMore && !showAll && (
                  <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={() => setShowAll(true)}>
                    Voir tout ({sortedFollowing.length})
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      ) : tab === 'activity' ? (
        <div className="space-y-3">
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/30 p-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
                  </div>
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-secondary shrink-0" />
                </div>
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-bold">Aucune activité récente</p>
              <p className="text-xs text-muted-foreground">L'activité de tes amis des 7 derniers jours apparaîtra ici.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-1">7 derniers jours</p>
              {activityFeed.map((item) => {
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(item.date).getTime();
                  const h = Math.floor(diff / 3600000);
                  const d = Math.floor(diff / 86400000);
                  if (h < 1) return 'À l\'instant';
                  if (h < 24) return `il y a ${h}h`;
                  return `il y a ${d}j`;
                })();
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-card/50 p-3 backdrop-blur-md">
                    <Avatar className="h-10 w-10 shrink-0 cursor-pointer transition-transform duration-150 active:scale-90" onClick={() => navigate(`/u/${item.userId}`)}>
                      <AvatarImage src={item.profileAvatarUrl} />
                      <AvatarFallback className="text-xs">{item.pseudo[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground leading-snug">
                        <span className="font-semibold">{item.pseudo}</span>
                        {' '}
                        {item.type === 'like'
                          ? <><Heart className="inline h-3 w-3 text-red-500 fill-red-500 mb-0.5" /> a aimé</>
                          : <><Music2 className="inline h-3 w-3 text-primary mb-0.5" /> a uploadé</>
                        }
                        {' '}
                        <span className="font-medium">{item.song.title}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.song.author} · {timeAgo}</p>
                    </div>
                    <img
                      src={songCoverUrl(item.song)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {user && (
            <FriendsWeeklyLeaderboard currentUserId={user.id} currentUserProfile={profile} friends={following} />
          )}
        </div>
      )}
      </TabFade>

      {/* ── Modal ami : profil ou chat ── */}
      <Dialog open={!!selectedFriend} onOpenChange={(open) => { if (!open) setSelectedFriend(null); }}>
        <DialogContent className="max-w-xs mx-auto rounded-3xl">
          {selectedFriend && (
            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="relative">
                <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                  <AvatarImage src={avatarUrl(selectedFriend as any)} />
                  <AvatarFallback className="text-2xl">{selectedFriend.pseudo?.[0] || '?'}</AvatarFallback>
                </Avatar>
                {(unreadBySender[selectedFriend.user_id] || 0) > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground ring-2 ring-background">
                    {unreadBySender[selectedFriend.user_id]}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold">{selectedFriend.pseudo || 'Anonyme'}</p>
                {selectedFriend.bio && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{selectedFriend.bio}</p>}
              </div>
              <div className="flex w-full flex-col gap-2">
                <Button
                  className="w-full rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm"
                  onClick={() => { const id = selectedFriend.user_id; setSelectedFriend(null); navigate(`/chat/${id}`); }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ouvrir le chat
                  {(unreadBySender[selectedFriend.user_id] || 0) > 0 && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      {unreadBySender[selectedFriend.user_id]}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl font-semibold"
                  onClick={() => { const id = selectedFriend.user_id; setSelectedFriend(null); navigate(`/u/${id}`); }}
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Voir le profil
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Choix : créer ou rejoindre une session ── */}
      <Dialog open={showSessionChoice} onOpenChange={setShowSessionChoice}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Écouter ensemble
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <Button
              className="w-full rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm"
              disabled={sessionCreating}
              onClick={createSessionFromSocial}
            >
              <Radio className="mr-2 h-4 w-4" />Créer une session
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl font-semibold"
              onClick={() => { setShowSessionChoice(false); setShowJoinDialog(true); }}
            >
              <Users className="mr-2 h-4 w-4" />Rejoindre une session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rejoindre par code ── */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rejoindre une session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Code à 8 chiffres"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinSessionByCode()}
              maxLength={8}
              autoFocus
              className="text-center text-lg tracking-widest"
            />
            <Button
              className="w-full rounded-xl bg-gradient-primary font-semibold"
              disabled={joiningSession || !joinCodeInput.trim()}
              onClick={joinSessionByCode}
            >
              Rejoindre
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sheet Écoute partagée ── */}
      <Sheet open={showSessionSheet} onOpenChange={setShowSessionSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Écoute partagée
            </SheetTitle>
          </SheetHeader>

          {activeSession && (
            <div className="space-y-5">
              {isPermanentActiveSession ? (
                /* Session permanente : pas de code (fuite = n'importe qui peut rejoindre),
                   visibilité automatique auprès des abonnés */
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-orange-400">
                    <Radio className="h-4 w-4" />Session permanente
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isSessionHost
                      ? 'Visible automatiquement par tes abonnés sur leur accueil — pas de code à partager.'
                      : "Tu as rejoint la session permanente de l'hôte."}
                    {' '}{activeSession.participants?.length ?? 1} personne{(activeSession.participants?.length ?? 1) > 1 ? 's' : ''} connectée{(activeSession.participants?.length ?? 1) > 1 ? 's' : ''}.
                  </p>
                </div>
              ) : (
                /* Code */
                <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Code de session</p>
                    <p className="text-2xl font-bold tracking-[0.2em] text-primary">{activeSession.code}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-xl"
                    onClick={() => { navigator.clipboard.writeText(activeSession.code || ''); toast.success('Code copié !'); }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Inviter des amis — non disponible pour une session permanente (auto-visible) */}
              {!isPermanentActiveSession && following.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-bold">Inviter des amis</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {following.map((f) => {
                      const alreadyIn = activeSession.participants?.includes(f.user_id);
                      const invited = invitedIds.has(f.user_id);
                      return (
                        <div key={f.user_id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 px-3 py-2">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={avatarUrl(f as any)} />
                            <AvatarFallback className="text-xs">{f.pseudo?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">{f.pseudo}</p>
                          {alreadyIn ? (
                            <span className="text-xs text-green-500 font-medium">Dans la session</span>
                          ) : invited ? (
                            <span className="text-xs text-muted-foreground font-medium">Invité ✓</span>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 rounded-xl bg-gradient-primary text-xs font-semibold"
                              onClick={() => inviteFriendFromSocial(f.user_id)}
                            >
                              <Send className="mr-1 h-3 w-3" />Inviter
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => { setShowSessionSheet(false); navigate('/listen-together'); }}
                >
                  Ouvrir la session
                </Button>
                {isSessionHost ? (
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl"
                    onClick={endSessionFromSocial}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />Terminer
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl"
                    onClick={leaveSessionFromSocial}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />Quitter
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
