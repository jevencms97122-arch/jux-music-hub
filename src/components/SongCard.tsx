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

  return (
    <button
      onClick={() => playSong(song)}
      className={`${size === 'sm' ? 'w-full' : 'w-36 sm:w-40 flex-shrink-0'} text-left group`}
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
          <div className="absolute inset-0 bg-background/30 flex items-center justify-center">
            <div className="flex items-end gap-[3px] h-8">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="w-[3px] bg-primary rounded-full"
                  style={{
                    animation: `equalizerBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
      <p className="text-xs text-muted-foreground truncate">{song.author}</p>
    </button>
  );
}
