import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pb } from '@/lib/pocketbase';
import { recordToSong } from '@/lib/pbUtils';
import { songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { Loader2, Trash2, Music2 } from 'lucide-react';
import HoldToConfirmButton from '@/components/HoldToConfirmButton';
import type { Song } from '@/types/music';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export default function MySongsSheet({ open, onOpenChange, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [confirmStep, setConfirmStep] = useState<'ask' | 'hold'>('ask');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    pb.collection('songs').getFullList({ filter: `uploaded_by = "${userId}"`, sort: '-created', requestKey: null })
      .then((items) => setSongs(items.map(recordToSong)))
      .catch(() => toast.error('Impossible de charger tes musiques'))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const openDeleteFlow = (song: Song) => {
    setPendingDelete(song);
    setConfirmStep('ask');
  };

  const handleFirstConfirm = () => setConfirmStep('hold');

  const handleFinalDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await pb.collection('songs').delete(pendingDelete.id);
      setSongs((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      toast.success('Musique supprimée');
      setPendingDelete(null);
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
          <SheetHeader className="mb-4 flex-shrink-0">
            <SheetTitle>Mes musiques publiées</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {!loading && songs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <Music2 className="h-6 w-6" />
                <p className="text-sm">Tu n'as encore rien publié.</p>
              </div>
            )}
            {!loading && songs.map((song) => (
              <div key={song.id} className="flex items-center gap-3 rounded-xl bg-card/60 p-2.5">
                <img src={songCoverUrl(song)} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{song.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{song.author} · {song.play_count} écoute{song.play_count > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => openDeleteFlow(song)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Étape 1 : confirmation classique */}
      <Dialog open={!!pendingDelete && confirmStep === 'ask'} onOpenChange={(v) => { if (!v) setPendingDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer "{pendingDelete?.title}" ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible — le morceau sera définitivement retiré de Nexora Music.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleFirstConfirm}>Continuer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Étape 2 : maintien 10s pour confirmer définitivement */}
      <Dialog open={!!pendingDelete && confirmStep === 'hold'} onOpenChange={(v) => { if (!v) setPendingDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmation finale</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Maintiens le bouton appuyé pendant 10 secondes pour supprimer définitivement "{pendingDelete?.title}".
          </p>
          {deleting ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-destructive" />
            </div>
          ) : (
            <HoldToConfirmButton
              label="Maintenir pour supprimer définitivement"
              onConfirm={handleFinalDelete}
            />
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setPendingDelete(null)} disabled={deleting}>Annuler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
