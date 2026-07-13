import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListMusic, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Playlist } from '@/types/music';
import { getLocalPlaylists, addTrackToLocalPlaylist, type LocalPlaylist } from '@/lib/offlinePlaylists';

interface PlaylistEntry {
  playlist: Playlist;
  isCollab: boolean;
  ownerPseudo?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  songId: string;
}

export default function AddToPlaylistModal({ open, onOpenChange, songId }: Props) {
  const { user } = useAuth();
  const { offline } = useOfflineMode();
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([]);

  useEffect(() => {
    if (!open) return;
    if (offline) {
      getLocalPlaylists().then(setLocalPlaylists);
      return;
    }
    if (!user) return;
    (async () => {
      const toPlaylist = (r: any): Playlist => ({
        id: r.id, title: r.title, description: r.description, is_public: r.is_public,
        owner_id: r.owner_id, view_count: r.view_count, play_count: r.play_count,
        likes_count: r.likes_count, thumbnail_mode: r.thumbnail_mode,
        created_at: r.created, updated_at: r.updated,
      });

      // Own playlists + collaborative playlists in parallel
      const [ownRes, collabRes] = await Promise.all([
        pb.collection('playlists').getList(1, 50, { filter: `owner_id = "${user.id}"`, sort: '-created', requestKey: null }),
        pb.collection('playlist_collaborators').getList(1, 50, { filter: `user_id = "${user.id}"`, requestKey: null }),
      ]);

      const result: PlaylistEntry[] = ownRes.items.map((r) => ({ playlist: toPlaylist(r), isCollab: false }));

      if (collabRes.items.length > 0) {
        const collabPlaylistIds = [...new Set(collabRes.items.map((r: any) => r.playlist_id).filter(Boolean))] as string[];
        const pFilter = collabPlaylistIds.map((id) => `id = "${id}"`).join(' || ');
        const cPlayRes = await pb.collection('playlists').getList(1, 50, { filter: pFilter, requestKey: null });

        // Fetch owner profiles for collab playlists
        const ownerIds = [...new Set(cPlayRes.items.map((p: any) => p.owner_id).filter(Boolean))] as string[];
        let ownerMap: Record<string, string> = {};
        if (ownerIds.length > 0) {
          const oFilter = ownerIds.map((id) => `user_id = "${id}"`).join(' || ');
          const ownerProfiles = await pb.collection('profiles').getList(1, 50, { filter: oFilter, requestKey: null });
          for (const p of ownerProfiles.items) ownerMap[p.user_id as string] = p.pseudo as string;
        }

        for (const r of cPlayRes.items) {
          // Don't duplicate if user somehow owns it too
          if (!result.find((e) => e.playlist.id === r.id)) {
            result.push({
              playlist: toPlaylist(r),
              isCollab: true,
              ownerPseudo: ownerMap[r.owner_id] || '?',
            });
          }
        }
      }

      setEntries(result);
    })();
  }, [open, user]);

  const addLocal = async (playlist: LocalPlaylist) => {
    if (playlist.trackIds.includes(songId)) {
      toast.error('Ce son est déjà dans la playlist');
      return;
    }
    await addTrackToLocalPlaylist(playlist.id, songId);
    toast.success('Ajouté à la playlist');
    onOpenChange(false);
  };

  const add = async (entry: PlaylistEntry) => {
    if (!user) return;
    try {
      // For collab playlists, verify the user is still a collaborator
      if (entry.isCollab) {
        const check = await pb.collection('playlist_collaborators').getList(1, 1, {
          filter: `playlist_id = "${entry.playlist.id}" && user_id = "${user.id}"`,
          requestKey: null,
        });
        if (check.items.length === 0) {
          toast.error("Vous n'avez pas l'autorisation");
          return;
        }
      }

      const existing = await pb.collection('playlist_songs').getList(1, 1, {
        filter: `playlist_id = "${entry.playlist.id}" && song_id = "${songId}"`,
        requestKey: null,
      });
      if (existing.items.length > 0) {
        toast.error('Ce son est déjà dans la playlist');
        return;
      }
      await pb.collection('playlist_songs').create({
        playlist_id: entry.playlist.id,
        song_id: songId,
        added_by: user.id,
        position: existing.totalItems,
      });
      toast.success('Ajouté à la playlist');
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter à une playlist</DialogTitle></DialogHeader>
        {offline ? (
          localPlaylists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Crée d'abord une playlist depuis l'onglet Playlists.</p>
          ) : (
            <div className="space-y-1">
              {localPlaylists.map((p) => (
                <Button key={p.id} variant="ghost" className="w-full justify-start h-auto py-2.5 px-3" onClick={() => addLocal(p)}>
                  <ListMusic className="mr-2 h-4 w-4 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                  </div>
                  <Plus className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              ))}
            </div>
          )
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crée d'abord une playlist depuis l'onglet Playlists.</p>
        ) : (
          <div className="space-y-1">
            {entries.map((e) => (
              <Button key={e.playlist.id} variant="ghost" className="w-full justify-start h-auto py-2.5 px-3" onClick={() => add(e)}>
                <ListMusic className="mr-2 h-4 w-4 shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{e.playlist.title}</p>
                  {e.isCollab && e.ownerPseudo && (
                    <p className="text-[10px] text-muted-foreground">Créé par {e.ownerPseudo}</p>
                  )}
                </div>
                <Plus className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
