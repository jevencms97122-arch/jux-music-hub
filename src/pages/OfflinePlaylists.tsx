import { useEffect, useState } from 'react';
import { useSeo } from '@/lib/useSeo';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ListMusic, Plus, ChevronRight, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createLocalPlaylist, getLocalPlaylists, type LocalPlaylist } from '@/lib/offlinePlaylists';

export default function OfflinePlaylists() {
  useSeo({ title: 'Playlists — Nexora Music', description: 'Tes playlists hors connexion.', path: '/playlists' });
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');

  const load = () => {
    setLoading(true);
    getLocalPlaylists().then(setPlaylists).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createPlaylist = async () => {
    if (!title.trim()) return;
    try {
      await createLocalPlaylist(title.trim());
      toast.success('Playlist créée');
      setCreateOpen(false);
      setTitle('');
      load();
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  return (
    <div className="relative min-h-screen pb-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

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
            <DialogHeader><DialogTitle>Nouvelle playlist hors ligne</DialogTitle></DialogHeader>
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

      <p className="relative px-5 mt-2 text-xs text-muted-foreground">
        Ces playlists ne contiennent que tes sons ajoutés localement et ne sont visibles qu'en mode hors connexion.
      </p>

      <section className="relative px-5 mt-5 animate-fade-slide-up delay-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/30 p-3">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        ) : playlists.length > 0 ? (
          <div className="space-y-2">
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/playlist/${p.id}`)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-3 text-left transition-colors hover:bg-card active:scale-[0.99]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
                  <ListMusic className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.trackIds.length} {p.trackIds.length === 1 ? 'titre' : 'titres'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Music2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-bold">Aucune playlist</p>
            <p className="text-xs text-muted-foreground">Crée ta première playlist hors ligne pour organiser tes sons locaux.</p>
            <Button size="sm" className="mt-3 rounded-xl bg-gradient-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Créer une playlist
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
