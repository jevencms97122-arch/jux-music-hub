import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Play, Heart, Trash2, ListMusic, Users, UserPlus, X, Settings2, Globe, Lock, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Song, Playlist } from '@/types/music';
import { recordToSong } from '@/lib/pbUtils';
import CachedImage from '@/components/CachedImage';

const fmtDuration = (s: number) => {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [liked, setLiked] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [collabRecords, setCollabRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabSearch, setCollabSearch] = useState('');
  const [collabResults, setCollabResults] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPublic, setSettingsPublic] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<{ pseudo: string; avatar_url: string; user_id: string } | null>(null);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await pb.collection('playlists').getOne(id);
        setPlaylist({ id: p.id, title: p.title, description: p.description, is_public: p.is_public, owner_id: p.owner_id, view_count: p.view_count, play_count: p.play_count, likes_count: p.likes_count, thumbnail_mode: p.thumbnail_mode, created_at: p.created, updated_at: p.updated } as Playlist);

        // Fetch owner profile
        const ownerRes = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${p.owner_id}"`, requestKey: null }).catch(() => ({ items: [] as any[] }));
        if (ownerRes.items[0]) {
          const op = ownerRes.items[0];
          setOwnerProfile({ pseudo: op.pseudo || '?', user_id: op.user_id, avatar_url: avatarUrl(op) });
        }

        const ps = await pb.collection('playlist_songs').getList(1, 100, { filter: `playlist_id = "${id}"`, sort: 'position', requestKey: null });
        const ids = ps.items.map((r: any) => r.song_id).filter(Boolean);

        const songsList: Song[] = [];
        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50);
          const filters = batch.map((sId: string) => `id = "${sId}"`).join(' || ');
          const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
          songsList.push(...res.items.map(recordToSong));
        }
        setSongs(songsList);

        if (user) {
          const likeRecord = await pbGetFirst('playlist_likes', `playlist_id = "${id}" && user_id = "${user.id}"`);
          setLiked(!!likeRecord);
        }

        const collabs = await pb.collection('playlist_collaborators').getList(1, 50, { filter: `playlist_id = "${id}"`, requestKey: null });
        setCollabRecords(collabs.items);
        const userIds = collabs.items.map((r: any) => r.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const profFilters = userIds.map((uid: string) => `user_id = "${uid}"`).join(' || ');
          const profs = await pb.collection('profiles').getList(1, 50, { filter: profFilters, requestKey: null });
          setCollaborators(profs.items.map((r: any) => {
            const rec = collabs.items.find((c: any) => c.user_id === r.user_id);
            return { id: r.user_id, pseudo: r.pseudo, avatar_url: avatarUrl(r), role: rec?.role ?? 'viewer', collabId: rec?.id };
          }));
        } else {
          setCollaborators([]);
        }
      } catch { navigate('/playlists'); }
      setLoading(false);
    })();
  }, [id, user]);

  // Must be before early returns — hooks cannot be called conditionally
  useEffect(() => {
    if (!collabSearch.trim()) { setCollabResults([]); return; }
    const timer = setTimeout(() => { searchCollab(); }, 400);
    return () => clearTimeout(timer);
  }, [collabSearch]);

  if (loading) {
    return (
      <div className="relative min-h-screen pb-40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />
        <div className="relative flex flex-col items-center px-5 pt-6">
          <div className="mb-6 h-9 w-9 self-start animate-pulse rounded-full bg-secondary" />
          <div className="h-40 w-40 animate-pulse rounded-3xl bg-secondary" />
          <div className="mt-5 h-5 w-40 animate-pulse rounded bg-secondary" />
          <div className="mt-2 h-3 w-28 animate-pulse rounded bg-secondary" />
          <div className="mt-6 h-11 w-full animate-pulse rounded-xl bg-secondary" />
          <div className="mt-6 w-full space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!playlist) return null;

  const removeSong = async (songId: string) => {
    try {
      const records = await pb.collection('playlist_songs').getList(1, 1, { filter: `playlist_id = "${id}" && song_id = "${songId}"`, requestKey: null });
      if (records.items[0]) await pb.collection('playlist_songs').delete(records.items[0].id);
      setSongs((s) => s.filter((s) => s.id !== songId));
      toast.success('Retiré de la playlist');
    } catch {}
  };

  const toggleLike = async () => {
    if (!user || !id) return;
    try {
      if (liked) {
        const likeRecord = await pbGetFirst('playlist_likes', `playlist_id = "${id}" && user_id = "${user.id}"`);
        if (likeRecord) await pb.collection('playlist_likes').delete(likeRecord.id);
        setLiked(false);
      } else {
        await pb.collection('playlist_likes').create({ playlist_id: id, user_id: user.id });
        setLiked(true);
      }
    } catch {}
  };

  const deletePlaylist = async () => {
    if (!id) return;
    try { await pb.collection('playlists').delete(id); navigate('/playlists'); } catch {}
  };

  const searchCollab = async () => {
    if (!collabSearch.trim() || !user) { setCollabResults([]); return; }
    try {
      // Fetch mutual follows: people I follow AND who follow me back
      const [iFollow, followMe] = await Promise.all([
        pb.collection('follows').getList(1, 200, { filter: `follower_id = "${user.id}" && status = "accepted"`, requestKey: null }),
        pb.collection('follows').getList(1, 200, { filter: `following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      ]);
      const iFollowIds = new Set(iFollow.items.map((f: any) => f.following_id as string));
      const followMeIds = new Set(followMe.items.map((f: any) => f.follower_id as string));
      const mutualIds = [...iFollowIds].filter((id) => followMeIds.has(id));
      if (mutualIds.length === 0) { setCollabResults([]); return; }

      // Filter profiles by pseudo search AND mutual follow
      const mutualFilter = mutualIds.map((id) => `user_id = "${id}"`).join(' || ');
      const res = await pb.collection('profiles').getList(1, 10, {
        filter: `pseudo ~ "${collabSearch.trim()}" && (${mutualFilter})`,
        requestKey: null,
      });
      setCollabResults(res.items.map((r: any) => ({ user_id: r.user_id, pseudo: r.pseudo })));
    } catch {}
  };

  const addCollab = async (targetUserId: string) => {
    if (!id || !user) return;
    const already = collaborators.find((c) => c.id === targetUserId);
    if (already) { toast.error('Déjà collaborateur'); return; }
    try {
      // Verify mutual follow before adding
      const [iFollow, theyFollow] = await Promise.all([
        pb.collection('follows').getList(1, 1, { filter: `follower_id = "${user.id}" && following_id = "${targetUserId}" && status = "accepted"`, requestKey: null }),
        pb.collection('follows').getList(1, 1, { filter: `follower_id = "${targetUserId}" && following_id = "${user.id}" && status = "accepted"`, requestKey: null }),
      ]);
      if (iFollow.items.length === 0 || theyFollow.items.length === 0) {
        toast.error('Vous devez vous suivre mutuellement');
        return;
      }
      await pb.collection('playlist_collaborators').create({ playlist_id: id, user_id: targetUserId, role: 'editor' });
      toast.success('Collaborateur ajouté');
      setCollabSearch('');
      setCollabResults([]);
      const collabs = await pb.collection('playlist_collaborators').getList(1, 50, { filter: `playlist_id = "${id}"`, requestKey: null });
      const userIds = collabs.items.map((r: any) => r.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const profFilters = userIds.map((uid: string) => `user_id = "${uid}"`).join(' || ');
        const profs = await pb.collection('profiles').getList(1, 50, { filter: profFilters, requestKey: null });
        setCollaborators(profs.items.map((r: any) => {
          const rec = collabs.items.find((c: any) => c.user_id === r.user_id);
          return { id: r.user_id, pseudo: r.pseudo, avatar_url: avatarUrl(r), role: rec?.role ?? 'viewer', collabId: rec?.id };
        }));
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const removeCollab = async (collabId: string, userId: string) => {
    try {
      await pb.collection('playlist_collaborators').delete(collabId);
      setCollaborators((c) => c.filter((x) => x.id !== userId));
      toast.success('Collaborateur retiré');
    } catch {}
  };

  const isOwner = user?.id === playlist.owner_id;
  const isAdmin = isOwner ||
    collabRecords.some((c: any) => c.user_id === user?.id && c.role === 'admin');

  const openSettings = () => {
    setSettingsPublic(playlist?.is_public ?? false);
    setShowSettings(true);
  };

  const saveSettings = async () => {
    if (!id) return;
    try {
      await pb.collection('playlists').update(id, { is_public: settingsPublic });
      setPlaylist((prev) => prev ? { ...prev, is_public: settingsPublic } : prev);
      setShowSettings(false);
      toast.success('Paramètres sauvegardés');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const mosaicCovers = songs.slice(0, 4).map((s) => songCoverUrl(s)).filter(Boolean);

  return (
    <div className="relative min-h-screen pb-40">
      {/* Halo héro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header ── */}
      <header className="relative flex items-center justify-between px-5 pt-6 animate-fade-slide-up">
        <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button variant="ghost" size="icon" aria-label="Paramètres" className="text-muted-foreground hover:text-foreground" onClick={openSettings}>
              <Settings2 className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Aimer" onClick={toggleLike}>
            <Heart className={cn('h-5 w-5', liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground')} />
          </Button>
          {isOwner && (
            <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={deletePlaylist}>
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          )}
        </div>
      </header>

      {/* ── Héro : cover + infos ── */}
      <section className="relative flex flex-col items-center px-5 pt-4 text-center animate-fade-slide-up delay-1">
        {/* Cover mosaïque (4 premières covers) ou icône */}
        <div className="h-40 w-40 overflow-hidden rounded-3xl shadow-card ring-1 ring-white/[0.06]">
          {mosaicCovers.length >= 4 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2">
              {mosaicCovers.map((c, i) => (
                <img key={i} src={c} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
          ) : mosaicCovers.length > 0 ? (
            <img src={mosaicCovers[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-primary">
              <ListMusic className="h-14 w-14 text-primary-foreground" />
            </div>
          )}
        </div>

        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{playlist.title}</h1>
        {playlist.description && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{playlist.description}</p>}

        {/* Meta chips */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {playlist.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {playlist.is_public ? 'Publique' : 'Privée'}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Music2 className="h-3 w-3" />
            {songs.length} {songs.length === 1 ? 'titre' : 'titres'}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Heart className="h-3 w-3" />
            {playlist.likes_count ?? 0}
          </span>
        </div>

        {/* Créateur */}
        {ownerProfile && (
          <button onClick={() => navigate(`/u/${ownerProfile.user_id}`)} className="group mt-3 flex items-center gap-2">
            {ownerProfile.avatar_url ? (
              <img src={ownerProfile.avatar_url} alt={ownerProfile.pseudo} className="h-6 w-6 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                {ownerProfile.pseudo[0].toUpperCase()}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              par <span className="font-semibold text-foreground group-hover:underline">{ownerProfile.pseudo}</span>
            </span>
          </button>
        )}

        {/* Lecture */}
        {songs.length > 0 && (
          <Button
            className="mt-5 w-full rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm"
            onClick={() => playSongFromList(songs[0], songs)}
          >
            <Play className="mr-2 h-4 w-4 fill-primary-foreground" />Lecture
          </Button>
        )}
      </section>

      {/* ── Collaborateurs ── */}
      <section className="relative px-5 mt-6 animate-fade-slide-up delay-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Users className="h-4 w-4 text-primary" />
            Collaborateurs{collaborators.length > 0 && ` (${collaborators.length})`}
          </p>
          {isOwner && (
            <Dialog open={collabOpen} onOpenChange={setCollabOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-xl font-semibold">
                  <UserPlus className="mr-1 h-3.5 w-3.5" />Inviter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Gérer les collaborateurs</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Pseudo de l'utilisateur..."
                    value={collabSearch}
                    onChange={(e) => setCollabSearch(e.target.value)}
                  />
                  {collabResults.length > 0 && (
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {collabResults.map((r: any) => (
                        <div key={r.user_id} className="flex items-center gap-2 rounded-lg bg-card/50 px-3 py-2">
                          <Avatar className="h-7 w-7"><AvatarFallback>{r.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                          <span className="flex-1 text-sm">{r.pseudo}</span>
                          <Button size="sm" className="rounded-lg" onClick={() => addCollab(r.user_id)}>Ajouter</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {collaborators.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Collaborateurs actuels</p>
                      {collaborators.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg bg-card/50 px-3 py-2">
                          <Avatar className="h-7 w-7"><AvatarFallback>{c.pseudo?.[0] || '?'}</AvatarFallback></Avatar>
                          <span className="flex-1 text-sm">{c.pseudo || 'Anonyme'}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCollab(c.collabId, c.id)}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {collaborators.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {collaborators.map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/u/${c.id}`)}
                className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 py-1 pl-1 pr-3 text-xs font-medium transition-colors hover:bg-card"
              >
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
                    {(c.pseudo?.[0] || '?').toUpperCase()}
                  </div>
                )}
                {c.pseudo || 'Anonyme'}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun collaborateur pour l'instant.</p>
        )}
      </section>

      {/* ── Paramètres ── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Paramètres de la playlist</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <button
              onClick={() => setSettingsPublic(!settingsPublic)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card/50 px-4 py-3 text-left transition-colors hover:bg-card"
            >
              <div className="flex items-center gap-3">
                {settingsPublic
                  ? <Globe className="h-4 w-4 flex-shrink-0 text-primary" />
                  : <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{settingsPublic ? 'Publique' : 'Privée'}</p>
                  <p className="text-xs text-muted-foreground">
                    {settingsPublic ? 'Visible par tout le monde' : 'Visible uniquement par les collaborateurs'}
                  </p>
                </div>
              </div>
              <div className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', settingsPublic ? 'bg-primary' : 'bg-secondary')}>
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', settingsPublic ? 'translate-x-6' : 'translate-x-1')} />
              </div>
            </button>
            <Button className="w-full rounded-xl bg-gradient-primary font-semibold" onClick={saveSettings}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Titres ── */}
      <section className="relative px-5 mt-6 animate-fade-slide-up delay-3">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Music2 className="h-4 w-4 text-primary" />Titres
        </p>
        {songs.length > 0 ? (
          <div className="space-y-2">
            {songs.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => playSongFromList(s, songs)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-2 text-left transition-colors hover:bg-card"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <CachedImage src={songCoverUrl(s)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                  </div>
                  {fmtDuration(s.duration) && (
                    <span className="shrink-0 pr-1 text-[11px] text-muted-foreground">{fmtDuration(s.duration)}</span>
                  )}
                </button>
                {isOwner && (
                  <Button variant="ghost" size="icon" aria-label="Retirer" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeSong(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Music2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-bold">Playlist vide</p>
            <p className="text-xs text-muted-foreground">Ajoute des sons depuis le lecteur ou la recherche.</p>
          </div>
        )}
      </section>
    </div>
  );
}
