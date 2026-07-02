import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/lib/useSeo';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ListMusic, Plus, Globe, Heart, Lock, ChevronRight, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Playlist } from '@/types/music';

function recordToPlaylist(r: any): Playlist {
  return {
    id: r.id, title: r.title, description: r.description, is_public: r.is_public,
    owner_id: r.owner_id, view_count: r.view_count, play_count: r.play_count,
    likes_count: r.likes_count, thumbnail_mode: r.thumbnail_mode,
    created_at: r.created, updated_at: r.updated,
  } as Playlist;
}

type Tab = 'mine' | 'liked' | 'discover';

export default function Playlists() {
  useSeo({ title: 'Playlists — Nexora Music', description: 'Tes playlists et celles de la communauté Nexora Music.', path: '/playlists' });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [likedPlaylists, setLikedPlaylists] = useState<Playlist[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('mine');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mine, likes, songLikes, pubs] = await Promise.all([
        pb.collection('playlists').getList(1, 50, { filter: `owner_id = "${user.id}"`, sort: '-created', requestKey: null }),
        pb.collection('playlist_likes').getList(1, 200, { filter: `user_id = "${user.id}"`, requestKey: null }),
        pb.collection('song_likes').getList(1, 1, { filter: `user_id = "${user.id}"`, requestKey: null }),
        pb.collection('playlists').getList(1, 30, { filter: 'is_public = true', sort: '-likes_count', requestKey: null }),
      ]);
      setLikedSongsCount(songLikes.totalItems);
      setMyPlaylists(mine.items.map(recordToPlaylist));
      setPublicPlaylists(pubs.items.map(recordToPlaylist));

      const likedIds = likes.items.map((r: any) => r.playlist_id).filter(Boolean);
      if (likedIds.length > 0) {
        const filters = likedIds.map((id: string) => `id = "${id}"`).join(' || ');
        const res = await pb.collection('playlists').getList(1, 50, { filter: filters, requestKey: null });
        setLikedPlaylists(res.items.map(recordToPlaylist));
      } else {
        setLikedPlaylists([]);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const createPlaylist = async () => {
    if (!user || !title.trim()) return;
    try {
      await pb.collection('playlists').create({ title: title.trim(), owner_id: user.id, is_public: false, description: '' });
      toast.success('Playlist créée');
      setCreateOpen(false);
      setTitle('');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const tabs: { id: Tab; label: string; icon: typeof ListMusic; count: number }[] = [
    { id: 'mine', label: 'À moi', icon: ListMusic, count: myPlaylists.length },
    { id: 'liked', label: 'Aimées', icon: Heart, count: likedPlaylists.length },
    { id: 'discover', label: 'Découvrir', icon: Compass, count: publicPlaylists.length },
  ];

  return (
    <div className="relative min-h-screen pb-40">
      {/* Halo héro */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      {/* ── Header ── */}
      <header className="relative flex items-center justify-between px-5 pt-6 animate-fade-slide-up">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-extrabold tracking-tight">Playlists</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm">
              <Plus className="mr-1 h-4 w-4" />Créer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nouvelle playlist</DialogTitle></DialogHeader>
            <Input
              placeholder="Titre de la playlist"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
              autoFocus
            />
            <Button className="rounded-xl bg-gradient-primary font-semibold" onClick={createPlaylist} disabled={!title.trim()}>
              Créer
            </Button>
          </DialogContent>
        </Dialog>
      </header>

      {/* ── Titres likés — playlist virtuelle mise en avant ── */}
      <section className="relative px-5 mt-5 animate-fade-slide-up delay-1">
        <button
          onClick={() => navigate('/favorites')}
          className="group flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-3.5 text-left transition-colors hover:bg-card active:scale-[0.99]"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-400 shadow-soft">
            <Heart className="h-6 w-6 fill-white text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">Titres likés</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Privée · {likedSongsCount} {likedSongsCount === 1 ? 'titre' : 'titres'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

      {/* ── Onglets ── */}
      <section className="relative px-5 mt-5 animate-fade-slide-up delay-2">
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

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/30 p-3">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'mine' ? (
          myPlaylists.length > 0 ? (
            <PlaylistList playlists={myPlaylists} onOpen={(id) => navigate(`/playlist/${id}`)} showVisibility />
          ) : (
            <EmptyState
              icon={<ListMusic className="h-6 w-6 text-primary" />}
              title="Aucune playlist"
              subtitle="Crée ta première playlist pour organiser tes sons."
              action={
                <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />Créer une playlist
                </Button>
              }
            />
          )
        ) : tab === 'liked' ? (
          likedPlaylists.length > 0 ? (
            <PlaylistList playlists={likedPlaylists} onOpen={(id) => navigate(`/playlist/${id}`)} />
          ) : (
            <EmptyState
              icon={<Heart className="h-6 w-6 text-primary" />}
              title="Aucune playlist aimée"
              subtitle="Like des playlists publiques pour les retrouver ici."
            />
          )
        ) : publicPlaylists.length > 0 ? (
          <PlaylistList playlists={publicPlaylists} onOpen={(id) => navigate(`/playlist/${id}`)} />
        ) : (
          <EmptyState
            icon={<Globe className="h-6 w-6 text-primary" />}
            title="Rien à découvrir"
            subtitle="Aucune playlist publique pour l'instant."
          />
        )}
      </section>
    </div>
  );
}

function PlaylistList({ playlists, onOpen, showVisibility }: { playlists: Playlist[]; onOpen: (id: string) => void; showVisibility?: boolean }) {
  return (
    <div className="space-y-2">
      {playlists.map((p) => (
        <button
          key={p.id}
          onClick={() => onOpen(p.id)}
          className="group flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-3 text-left transition-colors hover:bg-card active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
            <ListMusic className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {showVisibility && (
                <span className="flex items-center gap-1">
                  {p.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {p.is_public ? 'Publique' : 'Privée'}
                  <span aria-hidden>·</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />{p.likes_count ?? 0}
              </span>
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
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
