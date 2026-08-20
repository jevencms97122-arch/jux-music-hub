import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2, Music, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import {
  listDownloadedSongsWithInfo,
  deleteDownloadedSongCompletely,
  getTotalSize,
  formatBytes,
  type DownloadedSongInfo,
} from '@/lib/downloadedSongsManager';

export default function DownloadedSongsSheet({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<DownloadedSongInfo[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listDownloadedSongsWithInfo()
      .then(setSongs)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleDelete = async (songId: string) => {
    setDeletingId(songId);
    try {
      await deleteDownloadedSongCompletely(songId);
      setSongs((prev) => prev.filter((s) => s.songId !== songId));
    } catch {
      toast.error('Impossible de supprimer ce téléchargement');
    } finally {
      setDeletingId(null);
    }
  };

  const totalSize = getTotalSize(songs);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-2 flex-shrink-0">
          <SheetTitle>Musiques téléchargées</SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-2 rounded-xl bg-card/60 border border-white/[0.06] px-3.5 py-2.5 mb-3 flex-shrink-0">
          <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            {loading ? 'Calcul en cours…' : `${songs.length} titre${songs.length > 1 ? 's' : ''} · ${formatBytes(totalSize)} au total`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
          {loading && (
            <p className="text-center text-xs text-muted-foreground py-8">Chargement…</p>
          )}
          {!loading && songs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Music className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Aucune musique téléchargée pour l'instant</p>
            </div>
          )}
          {songs.map((song) => (
            <div
              key={song.songId}
              className="flex items-center justify-between gap-3 rounded-xl bg-card/60 border border-white/[0.06] px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {song.author || 'Auteur inconnu'} · {formatBytes(song.sizeBytes)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                aria-label={`Supprimer ${song.title}`}
                disabled={deletingId === song.songId}
                onClick={() => handleDelete(song.songId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
