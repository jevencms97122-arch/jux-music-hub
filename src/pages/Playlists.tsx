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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, ListMusic, Heart, Globe, Lock, Compass } from 'lucide-react';
import { toast } from 'sonner';
import type { Playlist } from '@/types/music';
import { useSeo } from '@/lib/useSeo';

export default function Playlists() {
  useSeo({
    title: 'Playlists — Jux-Music',
    description: 'Crée tes playlists, explore les playlists publiques et collaboratives partagées par la communauté Jux-Music.',
    path: '/playlists',
  });
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [own, setOwn] = useState<Playlist[]>([]);
  const [liked, setLiked] = useState<Playlist[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
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

    const { data: pubs } = await supabase
      .from('playlists').select('*')
      .eq('is_public', true).neq('owner_id', authUser.id)
      .order('likes_count', { ascending: false }).limit(30);
    setPublicPlaylists((pubs ?? []) as Playlist[]);
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

  const Card = ({ p, showVisibility = true }: { p: Playlist; showVisibility?: boolean }) => (
    <button
      onClick={() => navigate(`/playlist/${p.id}`)}
      className="group flex items-center gap-3 rounded-xl border border-transparent bg-card/50 p-2.5 text-left transition-all hover:border-border hover:bg-card hover:shadow-card w-full"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-primary shadow-card">
        <ListMusic className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{p.title}</p>
        {showVisibility && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {p.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {p.is_public ? 'Publique' : 'Privée'}
            {p.likes_count > 0 && <> · <Heart className="h-3 w-3" /> {p.likes_count}</>}
          </p>
        )}
      </div>
    </button>
  );

  return (
    <div className="relative min-h-screen pb-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-gradient-hero" />
      <div className="relative px-4 py-6">
        <div className="mb-4 flex items-center justify-between" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
          <h1 className="text-2xl font-bold">Playlists</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary shadow-elegant"><Plus className="mr-1 h-4 w-4" /> Nouvelle</Button>
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

        <div style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}>
          <Tabs defaultValue="mine" className="w-full">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="mine" className="flex-1">Mes playlists</TabsTrigger>
              <TabsTrigger value="liked" className="flex-1">Likées</TabsTrigger>
              <TabsTrigger value="discover" className="flex-1"><Compass className="mr-1 h-3.5 w-3.5" />Explorer</TabsTrigger>
            </TabsList>

            <TabsContent value="mine" className="space-y-1.5">
              {own.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Tu n'as pas encore de playlist.</p>
                </div>
              ) : own.map((p, i) => <div key={p.id} style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}><Card p={p} /></div>)}
            </TabsContent>

            <TabsContent value="liked" className="space-y-1.5">
              {liked.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Aucune playlist likée.</p>
                </div>
              ) : liked.map((p, i) => <div key={p.id} style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}><Card p={p} /></div>)}
            </TabsContent>

            <TabsContent value="discover" className="space-y-1.5">
              {publicPlaylists.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Pas encore de playlists publiques.</p>
                </div>
              ) : publicPlaylists.map((p, i) => <div key={p.id} style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}><Card p={p} /></div>)}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}