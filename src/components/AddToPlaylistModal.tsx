import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const { authUser } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    if (!open || !authUser) return;
    (async () => {
      const { data } = await supabase
        .from('playlists').select('*').eq('owner_id', authUser.id).order('created_at', { ascending: false });
      setPlaylists((data ?? []) as Playlist[]);
    })();
  }, [open, authUser]);

  const add = async (playlistId: string) => {
    if (!authUser) return;
    const { count } = await supabase
      .from('playlist_songs').select('*', { count: 'exact', head: true }).eq('playlist_id', playlistId);
    const { error } = await supabase
      .from('playlist_songs')
      .insert({ playlist_id: playlistId, song_id: songId, added_by: authUser.id, position: count ?? 0 });
    if (error) { toast.error(error.message); return; }
    toast.success('Ajouté à la playlist');
    onOpenChange(false);
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
