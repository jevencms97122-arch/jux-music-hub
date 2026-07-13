import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { songCoverUrl, songAudioUrl } from '@/lib/storage';
import { recordToSong } from '@/lib/pbUtils';
import { usePlayer } from '@/contexts/PlayerContext';
import { Music2, Play, Pause, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Song, ChatMessage } from '@/types/music';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Widget affiché dans le chat quand une musique est partagée.
 * Lit l'extrait personnalisé (clip_start → clip_end) en aperçu,
 * et permet d'ouvrir le titre dans le lecteur complet.
 */
export default function ChatSongCard({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { playSong } = usePlayer();
  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);

  const clipStart = message.clip_start ?? 0;
  const clipEnd = message.clip_end ?? 0;
  const hasClip = clipEnd > clipStart;

  useEffect(() => {
    let cancelled = false;
    if (!message.song_id) { setNotFound(true); return; }
    pb.collection('songs').getOne(message.song_id, { requestKey: null })
      .then((r) => { if (!cancelled) setSong(recordToSong(r)); })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [message.song_id]);

  useEffect(() => () => {
    // Nettoyage à l'unmount
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  const stopPreview = () => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
  };

  const togglePreview = () => {
    if (!song) return;
    if (playing) { stopPreview(); return; }
    const url = songAudioUrl(song);
    if (!url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;
    const start = clipStart;
    const end = hasClip ? clipEnd : (song.duration || 0);
    const clipLen = Math.max(1, end - start);
    if (audio.currentTime < start || (end > 0 && audio.currentTime >= end)) {
      audio.currentTime = start;
    }
    audio.play().then(() => {
      setPlaying(true);
      const tick = () => {
        if (!audioRef.current) return;
        const t = audioRef.current.currentTime;
        setProgress(Math.min(1, Math.max(0, (t - start) / clipLen)));
        if ((end > 0 && t >= end) || audioRef.current.ended) {
          stopPreview();
          setProgress(0);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => setPlaying(false));
  };

  if (notFound) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
        <Music2 className="h-4 w-4" /> Musique indisponible
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 w-60">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-secondary shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'w-64 overflow-hidden rounded-2xl border',
      mine ? 'border-white/15 bg-white/10' : 'border-border/50 bg-card'
    )}>
      <div className="flex items-center gap-3 p-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
          {songCoverUrl(song) !== '/placeholder.svg'
            ? <img src={songCoverUrl(song)} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center bg-gradient-primary"><Music2 className="h-5 w-5 text-white" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{song.title}</p>
          <p className="truncate text-xs opacity-70">{song.author}</p>
          {hasClip && (
            <p className="text-[10px] opacity-60 mt-0.5">Extrait {fmt(clipStart)} → {fmt(clipEnd)}</p>
          )}
        </div>
        <button
          onClick={togglePreview}
          aria-label={playing ? 'Pause' : 'Écouter l\'extrait'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
      </div>
      {/* Barre de progression de l'extrait */}
      {(playing || progress > 0) && (
        <div className="h-1 w-full bg-black/20">
          <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <button
        onClick={() => { stopPreview(); playSong(song); }}
        className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 py-2 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
      >
        <ExternalLink className="h-3 w-3" /> Ouvrir dans le lecteur
      </button>
    </div>
  );
}
