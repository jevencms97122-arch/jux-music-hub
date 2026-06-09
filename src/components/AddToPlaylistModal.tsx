import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListMusic, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Playlist } from '@/types/music';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  songId: string;
}

export default function AddToPlaylistModal({ open, onOpenChange, songId }: Props) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const result = await pb.collection('playlists').getList(1, 50, { filter: `owner_id = "${user.id}"`, sort: '-created', requestKey: null });
      setPlaylists(result.items.map((r: any) => ({ id: r.id, title: r.title, description: r.description, is_public: r.is_public, owner_id: r.owner_id, view_count: r.view_count, play_count: r.play_count, likes_count: r.likes_count, thumbnail_mode: r.thumbnail_mode, created_at: r.created || r.created, updated_at: r.updated || r.updated })) as Playlist[]);
    })();
  }, [open, user]);

  const add = async (playlistId: string) => {
    if (!user) return;
    try {
      const existing = await pb.collection('playlist_songs').getList(1, 1, { filter: `playlist_id = "${playlistId}" && song_id = "${songId}"`, requestKey: null });
      const count = existing.totalItems;
      await pb.collection('playlist_songs').create({ playlist_id: playlistId, song_id: songId, added_by: user.id, position: count });
      toast.success('Ajouté à la playlist');
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter à une playlist</DialogTitle></DialogHeader>
        {playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crée d'abord une playlist depuis l'onglet Playlists.</p>
        ) : (
          <div className="space-y-1">
            {playlists.map((p) => (
              <Button key={p.id} variant="ghost" className="w-full justify-start" onClick={() => add(p.id)}>
                <ListMusic className="mr-2 h-4 w-4" /> {p.title}
                <Plus className="ml-auto h-4 w-4" />
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}