import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';
import { Play, Heart, Video, Music } from 'lucide-react';
import CachedImage from '@/components/CachedImage';

interface Props {
  song: Song;
  onPlay: () => void;
}

// formatCount removed as play count display is no longer needed

export default function SongCard({ song, onPlay }: Props) {
  return (
    <button
      onClick={onPlay}
      className="group flex flex-col items-start gap-2 text-left w-full"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-secondary shadow-card transition-all duration-300 group-hover:shadow-glow group-hover:scale-[1.02]">
        <CachedImage
          src={songCoverUrl(song)}
          alt={song.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Dark gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Hover play button */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/50 group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-elegant transition-transform duration-300 group-hover:scale-110 group-hover:shadow-glow">
            <Play className="h-6 w-6 fill-primary-foreground text-primary-foreground" />
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-[10px] font-medium text-white/90">
          {/* Play count removed */}
          {song.video_url && (
            <span className="flex items-center gap-1 rounded-lg bg-primary/80 px-2 py-1 backdrop-blur-md">
              <Video className="h-3 w-3" /> Vidéo
            </span>
          )}
        </div>

        {/* Subtle inner border */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
      </div>

      <div className="w-full px-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{song.title}</p>
        <p className="truncate text-xs text-muted-foreground">{song.author}</p>
      </div>
    </button>
  );
}