import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';
import { Play } from 'lucide-react';

interface Props {
  song: Song;
  onPlay: () => void;
}

export default function SongCard({ song, onPlay }: Props) {
  return (
    <button
      onClick={onPlay}
      className="group flex flex-col items-start gap-2 text-left w-full"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary">
        <img
          src={songCoverUrl(song)}
          alt={song.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
          <div className="rounded-full bg-primary p-3">
            <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
          </div>
        </div>
      </div>
      <div className="w-full">
        <p className="truncate text-sm font-medium text-foreground">{song.title}</p>
        <p className="truncate text-xs text-muted-foreground">{song.author}</p>
      </div>
    </button>
  );
}
