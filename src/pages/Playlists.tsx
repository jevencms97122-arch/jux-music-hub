import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ListMusic, Heart } from 'lucide-react';
import { toast } from 'sonner';
import type { Playlist } from '@/types/music';

export default function Playlists() {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [own, setOwn] = useState<Playlist[]>([]);
  const [liked, setLiked] = useState<Playlist[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!authUser) return;
    const { data: mine } = await supabase
      .from('playlists').select('*').eq('owner_id', authUser.id).order('created_at', { ascending: false });
    setOwn((mine ?? []) as Playlist[]);

    const { data: likes } = await supabase
      .from('playlist_likes').select('playlist_id').eq('user_id', authUser.id);
    const ids = (likes ?? []).map((l) => l.playlist_id);
    if (ids.length) {
      const { data } = await supabase.from('playlists').select('*').in('id', ids);
      setLiked((data ?? []) as Playlist[]);
    } else setLiked([]);
  };

  useEffect(() => { load(); }, [authUser]);

  const create = async () => {
    if (!authUser || !title.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('playlists')
      .insert({ owner_id: authUser.id, title: title.trim(), description: description.trim() || null, is_public: isPublic })
      .select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Playlist créée');
    setOpen(false); setTitle(''); setDescription(''); setIsPublic(true);
    navigate(`/playlist/${data.id}`);
  };

  const Card = ({ p }: { p: Playlist }) => (
    <button
      onClick={() => navigate(`/playlist/${p.id}`)}
      className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary w-full"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded bg-secondary">
        <ListMusic className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.title}</p>
        <p className="truncate text-xs text-muted-foreground">{p.is_public ? 'Publique' : 'Privée'}</p>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen px-4 py-6 pb-40">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Mes playlists</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nouvelle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle playlist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="flex items-center gap-2">
                <Switch id="pub" checked={isPublic} onCheckedChange={setIsPublic} />
                <Label htmlFor="pub">Publique</Label>
              </div>
              <Button className="w-full" onClick={create} disabled={creating || !title.trim()}>
                {creating ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {own.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tu n'as pas encore de playlist.</p>
      ) : (
        <div className="space-y-1">{own.map((p) => <Card key={p.id} p={p} />)}</div>
      )}

      {liked.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <Heart className="h-4 w-4" /> Playlists likées
          </h2>
          <div className="space-y-1">{liked.map((p) => <Card key={p.id} p={p} />)}</div>
        </>
      )}
    </div>
  );
}
