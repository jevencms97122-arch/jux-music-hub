import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { songCoverUrl, songAudioUrl } from '@/lib/storage';
import { usePlayer } from '@/contexts/PlayerContext';
import { Play, Pause, Pin } from 'lucide-react';

const fmtTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
import { cn } from '@/lib/utils';
import type { Song } from '@/types/music';

interface Props {
  songId: string;
  start: number;
  end?: number;
}

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.title || '', author: r.author || '', audio: r.audio || '',
    cover: r.cover || null, audio_url: r.audio_url || '',
    cover_url: r.cover_url || null, video_url: r.video_url || null, genre: r.genre || null,
    uploaded_by: r.uploaded_by || '', duration: r.duration || 0, play_count: r.play_count ?? 0,
    weekly_play_count: r.weekly_play_count ?? 0, likes_count: r.likes_count ?? 0,
    created_at: r.created, updated_at: r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

export default function PinnedTrack({ songId, start, end }: Props) {
  // end=undefined → joue jusqu'à la fin naturelle du son
  const { playSong } = usePlayer();
  const [song, setSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    pb.collection('songs').getOne(songId, { requestKey: null })
      .then((r) => setSong(recordToSong(r)))
      .catch(() => {});
  }, [songId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = start;
    }
    setPlaying(false);
    setProgress(0);
    cancelAnimationFrame(rafRef.current);
  };

  const togglePreview = () => {
    if (!song) return;

    if (playing) {
      stopPreview();
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const a = audioRef.current;
    const url = songAudioUrl(song);
    if (a.src !== url) a.src = url;
    a.currentTime = start;

    const tick = () => {
      if (a.ended || (end !== undefined && a.currentTime >= end)) {
        stopPreview();
        return;
      }
      const dur = isFinite(a.duration) ? a.duration : 0;
      const effectiveEnd = end ?? dur;
      const clipLen = effectiveEnd - start;
      const elapsed = a.currentTime - start;
      setProgress(clipLen > 0 ? Math.min(1, elapsed / clipLen) : 0);
      rafRef.current = requestAnimationFrame(tick);
    };

    a.play().then(() => {
      setPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => {});
  };

  if (!song) return null;

  const cover = songCoverUrl(song);
  const clipDuration = end !== undefined ? Math.round(end - start) : null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <Pin className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Titre épinglé</span>
      </div>
      <div className="flex items-center gap-3 px-3 pb-3">
        {/* Cover */}
        <div className="relative shrink-0 h-14 w-14 rounded-xl overflow-hidden bg-muted">
          {cover && <img src={cover} alt={song.title} className="h-full w-full object-cover" />}
          {/* Progress ring overlay when playing */}
          {playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2.5" />
                <circle
                  cx="16" cy="16" r="12" fill="none" stroke="white" strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - progress)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate">{song.author}</p>
          {start > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Démarre à {fmtTime(start)}</p>}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={togglePreview}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              playing ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
          </button>
          <button
            onClick={() => { stopPreview(); playSong(song); }}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Écouter
          </button>
        </div>
      </div>
    </div>
  );
}
