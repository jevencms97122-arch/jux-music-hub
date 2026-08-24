import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Download, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

interface CoverResult {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  label: string;
}

interface CoverSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  author: string;
  onSelect: (file: File) => void;
}

// Remplace la taille d'artwork par défaut d'iTunes (100x100) par une taille plus grande.
function upscaleArtwork(url: string, size: number): string {
  return url.replace(/\d+x\d+bb\.(jpg|png)/, `${size}x${size}bb.$1`);
}

export function CoverSearchModal({ open, onOpenChange, title, author, onSelect }: CoverSearchModalProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CoverResult[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const query = `${title} ${author}`.trim();
    if (!query) {
      setError('Ajoute un titre et un artiste avant de chercher une cover.');
      setResults([]);
      return;
    }
    setError(null);
    setLoading(true);
    setResults([]);

    const controller = new AbortController();
    (async () => {
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=24`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Recherche impossible');
        const data = await res.json();
        const seen = new Set<string>();
        const items: CoverResult[] = [];
        for (const track of data.results || []) {
          const raw = track.artworkUrl100 as string | undefined;
          if (!raw) continue;
          const full = upscaleArtwork(raw, 1200);
          if (seen.has(full)) continue;
          seen.add(full);
          items.push({
            id: `${track.trackId ?? items.length}`,
            thumbUrl: upscaleArtwork(raw, 300),
            fullUrl: full,
            label: `${track.trackName ?? ''} — ${track.artistName ?? ''}`.trim(),
          });
        }
        setResults(items);
        if (items.length === 0) setError('Aucune image trouvée pour cette recherche.');
      } catch (e: any) {
        if (e.name !== 'AbortError') setError("Erreur pendant la recherche d'images");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, title, author]);

  const handlePick = async (result: CoverResult) => {
    setDownloadingId(result.id);
    try {
      const res = await fetch(result.fullUrl);
      if (!res.ok) throw new Error('Téléchargement impossible');
      const blob = await res.blob();
      const ext = result.fullUrl.endsWith('.png') ? 'png' : 'jpg';
      const file = new File([blob], `cover.${ext}`, { type: blob.type || 'image/jpeg' });
      onSelect(file);
      toast.success('Cover téléchargée !');
      onOpenChange(false);
    } catch {
      toast.error("Impossible de télécharger cette image");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chercher une cover sur internet</DialogTitle>
          <DialogDescription>
            Résultats pour « {title || '...'} {author && `— ${author}`} »
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Recherche en cours...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground text-center">
            <ImageOff className="h-6 w-6" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={downloadingId !== null}
                onClick={() => handlePick(r)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border/50 disabled:opacity-60"
                title={r.label}
              >
                <img src={r.thumbUrl} alt={r.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                  {downloadingId === r.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Download className="h-5 w-5 text-white" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
