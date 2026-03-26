import { getSongCoverUrl } from '@/lib/pocketbase';
import type { Song } from '@/types/music';
import { Play } from 'lucide-react';
import React from 'react';

interface SongCardProps {
  song: Song;
  size?: 'sm' | 'md';
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay?: (song: Song) => void;
}

function SongCard({ song, size = 'md', isActive = false, isPlaying = false, onPlay }: SongCardProps) {
  return (
    <div
      className={`${size === 'sm' ? 'w-full' : 'w-36 sm:w-40 flex-shrink-0'} text-left group transition-all duration-300 hover:scale-[1.02]`}
    >
      <button
        onClick={() => onPlay?.(song)}
        className="w-full relative"
        type="button"
      >
        <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-secondary shadow-lg">
          <img
            src={getSongCoverUrl(song)}
            alt={song.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-primary/90 rounded-full p-3 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
          {isActive && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
              <div className="flex items-end gap-[3px] h-8">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-[3px] rounded-full ${isPlaying ? 'bg-primary animate-equalizer' : 'bg-white'}`}
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-1">
          <p className="text-sm font-semibold text-foreground truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{song.author}</p>
        </div>
      </button>
    </div>
  );
}

export { SongCard };
export default React.memo(SongCard, (prev, next) => {
  return (
    prev.size === next.size &&
    prev.song.id === next.song.id &&
    prev.song.title === next.song.title &&
    prev.song.author === next.song.author &&
    prev.isActive === next.isActive &&
    prev.isPlaying === next.isPlaying
  );
});
