import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';
import { Play, Video, Trash2 } from 'lucide-react';
import CachedImage from '@/components/CachedImage';

interface Props {
  song: Song;
  onPlay: () => void;
  onDelete?: () => void;
  /** Position dans la liste — décale l'animation d'apparition pour un effet en cascade. */
  index?: number;
}

function formatPlayCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${count}`;
}

export default function SongCard({ song, onPlay, onDelete, index }: Props) {
  return (
    <button
      onClick={onPlay}
      className="group flex flex-col items-start gap-2 text-left w-full animate-card-in"
      style={index != null ? { animationDelay: `${Math.min(index, 12) * 30}ms` } : undefined}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-secondary shadow-card transition-[box-shadow,transform] duration-300 group-hover:shadow-glow group-hover:scale-[1.03]">
        <CachedImage
          src={songCoverUrl(song)}
          alt={song.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Gradient — s'assombrit légèrement au hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-300 group-hover:opacity-80" />
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />

        {/* Play overlay — bouton sans backdrop-filter pour éviter le pop de blur */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-250 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-elegant">
            <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground ml-0.5" />
          </div>
        </div>

        {/* Supprimer (sons locaux du mode hors ligne) */}
        {onDelete && (
          <span
            role="button"
            aria-label="Supprimer"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/90 opacity-0 transition-opacity duration-200 hover:bg-destructive group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        )}

        {/* Video badge */}
        {song.video_url && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-[2px]">
              <Video className="h-2.5 w-2.5 text-primary" />
              Vidéo
            </span>
          </div>
        )}

        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.06]" />
      </div>

      <div className="w-full px-0.5">
        <p className="truncate text-[13px] font-semibold leading-snug text-foreground">{song.title}</p>
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] text-muted-foreground">{song.author}</p>
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
            <Play className="h-2.5 w-2.5 fill-muted-foreground" />
            {formatPlayCount(song.play_count ?? 0)}
          </span>
        </div>
      </div>
    </button>
  );
}
