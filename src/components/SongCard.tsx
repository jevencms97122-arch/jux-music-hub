import { getSongCoverUrl } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song } from '@/types/music';
import { Play } from 'lucide-react';

interface SongCardProps {
  song: Song;
  size?: 'sm' | 'md';
}

export default function SongCard({ song, size = 'md' }: SongCardProps) {
  const { playSong, currentSong, isPlaying } = usePlayer();
  const isActive = currentSong?.id === song.id;
  const w = size === 'sm' ? 'w-32' : 'w-40';

  return (
    <button
      onClick={() => playSong(song)}
      className={`${w} flex-shrink-0 text-left group`}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-2 bg-secondary">
        <img
          src={getSongCoverUrl(song)}
          alt={song.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="h-10 w-10 text-foreground fill-foreground" />
        </div>
        {isActive && isPlaying && (
          <div className="absolute bottom-2 left-2 flex gap-0.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 bg-primary rounded-full animate-pulse-glow" style={{ height: 12 + i * 4, animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
      <p className="text-xs text-muted-foreground truncate">{song.author}</p>
    </button>
  );
}
