import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ListMusic, Plus, Globe, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Playlist } from '@/types/music';

export default function Playlists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [likedPlaylists, setLikedPlaylists] = useState<Playlist[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');

  const load = async () => {
    if (!user) return;
    try {
      const [mine, likes] = await Promise.all([
        pb.collection('playlists').getList(1, 50, { filter: `owner_id = "${user.id}"`, sort: '-created', requestKey: null }),
        pb.collection('playlist_likes').getList(1, 200, { filter: `user_id = "${user.id}"`, requestKey: null }),
      ]);
      setMyPlaylists(mine.items.map((r: any) => ({ id: r.id, title: r.get('title'), description: r.get('description'), is_public: r.get('is_public'), owner_id: r.get('owner_id'), view_count: r.get('view_count'), play_count: r.get('play_count'), likes_count: r.get('likes_count'), thumbnail_mode: r.get('thumbnail_mode'), created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated })) as Playlist[]);
      
      const likedIds = likes.items.map((r: any) => r.get('playlist_id')).filter(Boolean);
      if (likedIds.length > 0) {
        const filters = likedIds.map((id: string) => `id = "${id}"`).join(' || ');
        const res = await pb.collection('playlists').getList(1, 50, { filter: filters, requestKey: null });
        setLikedPlaylists(res.items.map((r: any) => ({ id: r.id, title: r.get('title'), description: r.get('description'), is_public: r.get('is_public'), owner_id: r.get('owner_id'), view_count: r.get('view_count'), play_count: r.get('play_count'), likes_count: r.get('likes_count'), thumbnail_mode: r.get('thumbnail_mode'), created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated })) as Playlist[]);
      }
      
      const pubs = await pb.collection('playlists').getList(1, 30, { filter: 'is_public = true', sort: '-likes_count', requestKey: null });
      setPublicPlaylists(pubs.items.map((r: any) => ({ id: r.id, title: r.get('title'), description: r.get('description'), is_public: r.get('is_public'), owner_id: r.get('owner_id'), view_count: r.get('view_count'), play_count: r.get('play_count'), likes_count: r.get('likes_count'), thumbnail_mode: r.get('thumbnail_mode'), created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated })) as Playlist[]);
    } catch {}
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

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-bold">Playlists</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Créer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle playlist</DialogTitle></DialogHeader>
            <Input placeholder="Titre de la playlist" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPlaylist()} />
            <Button onClick={createPlaylist}>Créer</Button>
          </DialogContent>
        </Dialog>
      </header>

      {myPlaylists.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><ListMusic className="h-5 w-5" />Mes playlists</h2>
          <div className="space-y-2">
            {myPlaylists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="flex w-full items-center gap-3 rounded-xl bg-card/50 p-3 text-left hover:bg-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary"><ListMusic className="h-6 w-6 text-primary-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.is_public ? 'Publique' : 'Privée'} · {p.likes_count} likes</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {likedPlaylists.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Heart className="h-5 w-5" />Playlists aimées</h2>
          <div className="space-y-2">
            {likedPlaylists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="flex w-full items-center gap-3 rounded-xl bg-card/50 p-3 text-left hover:bg-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary"><ListMusic className="h-6 w-6 text-primary-foreground" /></div>
                <div className="min-w-0 flex-1"><p className="font-semibold truncate">{p.title}</p><p className="text-xs text-muted-foreground">{p.likes_count} likes</p></div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Globe className="h-5 w-5" />Playlists publiques</h2>
        {publicPlaylists.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune playlist publique pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {publicPlaylists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="flex w-full items-center gap-3 rounded-xl bg-card/50 p-3 text-left hover:bg-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary"><ListMusic className="h-6 w-6 text-primary-foreground" /></div>
                <div className="min-w-0 flex-1"><p className="font-semibold truncate">{p.title}</p><p className="text-xs text-muted-foreground">{p.likes_count} likes</p></div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}