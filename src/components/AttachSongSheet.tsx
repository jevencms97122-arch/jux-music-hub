import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { songAudioUrl, songCoverUrl } from '@/lib/storage';
import { recordToSong } from '@/lib/pbUtils';
import { sendSongShareMessage } from '@/hooks/useChat';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Music2, Play, Pause, Search, Send, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Song } from '@/types/music';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  onSent: (record: any) => void;
}

/** Sheet "Joindre une musique" — recherche/récents puis personnalisation de l'extrait, façon Instagram. */
export default function AttachSongSheet({ open, onOpenChange, recipientId, onSent }: Props) {
  const { user } = useAuth();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [recent, setRecent] = useState<Song[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [searching, setSearching] = useState(false);
  const [song, setSong] = useState<Song | null>(null);
  const [songDuration, setSongDuration] = useState(0);
  const [clip, setClip] = useState<[number, number]>([0, 30]);
  const [previewing, setPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setResults([]);
    setSong(null);
    setSending(false);
  }, [open]);

  // Musiques écoutées récemment — accès rapide, comme les stickers "récents" d'Instagram
  useEffect(() => {
    if (!open || !user) return;
    setLoadingRecent(true);
    (async () => {
      try {
        const hist = await pb.collection('listen_history').getList(1, 10, {
          filter: `user_id = "${user.id}"`, sort: '-listened_at', requestKey: null,
        });
        const songIds = [...new Set(hist.items.map((r: any) => r.song_id))].filter(Boolean) as string[];
        if (songIds.length === 0) { setRecent([]); return; }
        const filter = songIds.map((id) => `id = "${id}"`).join(' || ');
        const res = await pb.collection('songs').getList(1, 10, { filter, requestKey: null });
        const byId = new Map(res.items.map((s: any) => [s.id, recordToSong(s)]));
        setRecent(songIds.map((id) => byId.get(id)).filter(Boolean) as Song[]);
      } catch { setRecent([]); }
      setLoadingRecent(false);
    })();
  }, [open, user]);

  useEffect(() => {
    if (!term.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await pb.collection('songs').getList(1, 20, {
          filter: `title ~ "${term.trim()}" || author ~ "${term.trim()}"`, requestKey: null,
        });
        setResults(res.items.map(recordToSong));
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [term]);

  const stopPreview = () => {
    cancelAnimationFrame(rafRef.current);
    previewRef.current?.pause();
    setPreviewing(false);
  };

  useEffect(() => {
    if (!open) { stopPreview(); previewRef.current = null; }
  }, [open]);

  const pickSong = (s: Song) => {
    setSong(s);
    setPreviewProgress(0);
    const known = s.duration || 0;
    if (known > 0) {
      setSongDuration(known);
      setClip([0, Math.min(30, known)]);
      return;
    }
    const url = songAudioUrl(s);
    if (!url) return;
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = url;
    probe.addEventListener('loadedmetadata', () => {
      const d = Math.floor(probe.duration || 0);
      if (d > 0) { setSongDuration(d); setClip([0, Math.min(30, d)]); }
    });
  };

  const togglePreview = () => {
    if (!song) return;
    if (previewing) { stopPreview(); return; }
    const url = songAudioUrl(song);
    if (!url) { toast.error('Audio introuvable'); return; }
    if (!previewRef.current) previewRef.current = new Audio(url);
    const audio = previewRef.current;
    const [start, end] = clip;
    audio.currentTime = start;
    audio.play().then(() => {
      setPreviewing(true);
      const tick = () => {
        if (!previewRef.current) return;
        const t = previewRef.current.currentTime;
        setPreviewProgress(Math.min(1, Math.max(0, (t - start) / Math.max(1, end - start))));
        if (t >= end || previewRef.current.ended) { stopPreview(); setPreviewProgress(0); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => toast.error('Lecture impossible'));
  };

  const clipValid = clip[1] > clip[0];

  const send = async () => {
    if (!user || !song || !clipValid || sending) return;
    setSending(true);
    stopPreview();
    try {
      const rec = await sendSongShareMessage(user.id, recipientId, song.id, clip[0], clip[1]);
      onSent(rec);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'envoi");
    }
    setSending(false);
  };

  const renderSongRow = (s: Song) => (
    <button
      key={s.id}
      onClick={() => pickSong(s)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-2.5 text-left transition-colors hover:bg-card active:scale-[0.99]"
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
        {songCoverUrl(s) !== '/placeholder.svg'
          ? <img src={songCoverUrl(s)} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center bg-gradient-primary"><Music2 className="h-4 w-4 text-white" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{s.title}</p>
        <p className="truncate text-xs text-muted-foreground">{s.author}</p>
      </div>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {song && (
              <button onClick={() => setSong(null)} aria-label="Retour" className="rounded-lg p-1 hover:bg-white/[0.06]">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Music2 className="h-4 w-4 text-primary" />
            {song ? 'Personnalise l\'extrait' : 'Joindre une musique'}
          </SheetTitle>
        </SheetHeader>

        {!song ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Titre, artiste..."
                autoFocus
                className="h-11 rounded-2xl border-border/50 bg-card/60 pl-11 text-sm"
              />
            </div>

            {term.trim() ? (
              <div className="space-y-2">
                {searching ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Recherche...</p>
                ) : results.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Aucun résultat pour « {term.trim()} ».</p>
                ) : (
                  results.map(renderSongRow)
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Écoutés récemment
                </p>
                {loadingRecent ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[60px] animate-pulse rounded-2xl bg-secondary/60" />)}
                  </div>
                ) : recent.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Aucune écoute récente. Cherche un titre ci-dessus.</p>
                ) : (
                  recent.map(renderSongRow)
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                {songCoverUrl(song) !== '/placeholder.svg'
                  ? <img src={songCoverUrl(song)} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center bg-gradient-primary"><Music2 className="h-5 w-5 text-white" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{song.title}</p>
                <p className="truncate text-xs text-muted-foreground">{song.author}</p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-border/50 bg-card/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Extrait à envoyer</p>
                <button
                  onClick={togglePreview}
                  disabled={!clipValid}
                  className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95 transition-transform disabled:opacity-50"
                >
                  {previewing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {previewing ? 'Stop' : 'Aperçu'}
                </button>
              </div>
              {songDuration > 0 ? (
                <>
                  <Slider
                    value={clip}
                    min={0}
                    max={songDuration}
                    step={1}
                    minStepsBetweenThumbs={3}
                    onValueChange={(v) => { stopPreview(); setPreviewProgress(0); setClip([v[0], v[1]] as [number, number]); }}
                    className="my-2"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Début : <span className="font-semibold text-foreground">{fmt(clip[0])}</span></span>
                    <span className="font-medium text-primary">{fmt(Math.max(0, clip[1] - clip[0]))} d'extrait</span>
                    <span>Fin : <span className="font-semibold text-foreground">{fmt(clip[1])}</span></span>
                  </div>
                  {previewing && (
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${previewProgress * 100}%` }} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Chargement de la durée...</p>
              )}
            </div>

            <Button
              onClick={send}
              disabled={!clipValid || sending}
              className={cn('w-full rounded-xl bg-gradient-primary py-6 text-sm font-bold shadow-elegant-sm')}
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
