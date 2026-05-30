import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';
import { Play, Heart, Headphones, Video } from 'lucide-react';
import CachedImage from '@/components/CachedImage';

interface Props {
  song: Song;
  onPlay: () => void;
}

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

export default function SongCard({ song, onPlay }: Props) {
  return (
    <button
      onClick={onPlay}
      className="group flex flex-col items-start gap-2 text-left w-full"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-secondary shadow-card">
        <CachedImage
          src={songCoverUrl(song)}
          alt={song.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
          <div className="rounded-full bg-primary p-3.5 shadow-elegant transition-transform group-hover:scale-110">
            <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
          </div>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-[10px] font-medium text-white/90">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 backdrop-blur">
            <Headphones className="h-2.5 w-2.5" /> {formatCount(song.play_count ?? 0)}
          </span>
          {song.video_url && (
            <span className="flex items-center gap-1 rounded-full bg-primary/80 px-1.5 py-0.5 backdrop-blur">
              <Video className="h-2.5 w-2.5" /> Vidéo
            </span>
          )}
        </div>
      </div>
      <div className="w-full px-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{song.title}</p>
        <p className="truncate text-xs text-muted-foreground">{song.author}</p>
      </div>
    </button>
  );
}
