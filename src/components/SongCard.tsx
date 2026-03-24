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
    <button
      onClick={() => onPlay?.(song)}
      className={`${size === 'sm' ? 'w-full' : 'w-36 sm:w-40 flex-shrink-0'} text-left group transition transform hover:-translate-y-0.5 duration-150`}
      type="button"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-2 bg-secondary will-change-transform">
        <img
          src={getSongCoverUrl(song)}
          alt={song.title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
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
                  className="w-[3px] bg-primary rounded-full animate-equalizer"
                  style={{ animationDelay: `${i * 0.12}s` }}
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
