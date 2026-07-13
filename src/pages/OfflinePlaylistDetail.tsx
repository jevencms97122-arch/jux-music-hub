import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Play, Trash2, ListMusic, Plus, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Song } from '@/types/music';
import CachedImage from '@/components/CachedImage';
import {
  getLocalPlaylist, deleteLocalPlaylist, addTrackToLocalPlaylist,
  removeTrackFromLocalPlaylist, type LocalPlaylist,
} from '@/lib/offlinePlaylists';
import { getLocalTracks } from '@/lib/offlineLibrary';

const fmtDuration = (s: number) => {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function OfflinePlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<LocalPlaylist | null>(null);
  const [allTracks, setAllTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [pl, tracks] = await Promise.all([getLocalPlaylist(id), getLocalTracks()]);
    if (!pl) { navigate('/playlists'); return; }
    setPlaylist(pl);
    setAllTracks(tracks);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading || !playlist) {
    return (
      <div className="relative min-h-screen pb-40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />
        <div className="relative flex flex-col items-center px-5 pt-6">
          <div className="mb-6 h-9 w-9 self-start animate-pulse rounded-full bg-secondary" />
          <div className="h-40 w-40 animate-pulse rounded-3xl bg-secondary" />
          <div className="mt-5 h-5 w-40 animate-pulse rounded bg-secondary" />
        </div>
      </div>
    );
  }

  const songs = playlist.trackIds
    .map((tid) => allTracks.find((t) => t.id === tid))
    .filter((s): s is Song => !!s);

  const availableToAdd = allTracks.filter((t) => !playlist.trackIds.includes(t.id));

  const removeSong = async (songId: string) => {
    const updated = await removeTrackFromLocalPlaylist(playlist.id, songId);
    if (updated) setPlaylist(updated);
    toast.success('Retiré de la playlist');
  };

  const addSong = async (songId: string) => {
    const updated = await addTrackToLocalPlaylist(playlist.id, songId);
    if (updated) setPlaylist(updated);
  };

  const removePlaylist = async () => {
    if (!window.confirm('Supprimer cette playlist ?')) return;
    await deleteLocalPlaylist(playlist.id);
    navigate('/playlists');
  };

  return (
    <div className="relative min-h-screen pb-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-hero" />

      <header className="relative flex items-center justify-between px-5 pt-6 animate-fade-slide-up">
        <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={removePlaylist}>
          <Trash2 className="h-5 w-5 text-destructive" />
        </Button>
      </header>

      <section className="relative flex flex-col items-center px-5 pt-4 text-center animate-fade-slide-up delay-1">
        <div className="h-40 w-40 overflow-hidden rounded-3xl shadow-card ring-1 ring-white/[0.06]">
          {songs.length > 0 ? (
            <img src={songCoverUrl(songs[0])} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-primary">
              <ListMusic className="h-14 w-14 text-primary-foreground" />
            </div>
          )}
        </div>

        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{playlist.title}</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">Playlist hors ligne</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Music2 className="h-3 w-3" />
            {songs.length} {songs.length === 1 ? 'titre' : 'titres'}
          </span>
        </div>

        {songs.length > 0 && (
          <Button
            className="mt-5 w-full rounded-xl bg-gradient-primary font-semibold shadow-elegant-sm"
            onClick={() => playSongFromList(songs[0], songs)}
          >
            <Play className="mr-2 h-4 w-4 fill-primary-foreground" />Lecture
          </Button>
        )}
      </section>

      <section className="relative px-5 mt-6 animate-fade-slide-up delay-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Music2 className="h-4 w-4 text-primary" />Titres
          </p>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-xl font-semibold">
                <Plus className="mr-1 h-3.5 w-3.5" />Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter un son</DialogTitle></DialogHeader>
              {availableToAdd.length > 0 ? (
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {availableToAdd.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg bg-card/50 px-3 py-2">
                      <CachedImage src={songCoverUrl(s)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{s.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                      </div>
                      <Button size="sm" className="rounded-lg" onClick={() => addSong(s.id)}>Ajouter</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tous tes sons locaux sont déjà dans cette playlist.
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {songs.length > 0 ? (
          <div className="space-y-2">
            {songs.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => playSongFromList(s, songs)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-2 text-left transition-colors hover:bg-card"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <CachedImage src={songCoverUrl(s)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                  </div>
                  {fmtDuration(s.duration ?? 0) && (
                    <span className="shrink-0 pr-1 text-[11px] text-muted-foreground">{fmtDuration(s.duration ?? 0)}</span>
                  )}
                </button>
                <Button variant="ghost" size="icon" aria-label="Retirer" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeSong(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Music2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-bold">Playlist vide</p>
            <p className="text-xs text-muted-foreground">Ajoute des sons depuis ta bibliothèque locale.</p>
          </div>
        )}
      </section>
    </div>
  );
}
