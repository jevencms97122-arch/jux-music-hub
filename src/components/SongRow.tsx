import type { Song } from '@/types/music';
import SongCard from './SongCard';
import { ChevronRight } from 'lucide-react';

interface SongRowProps {
  title: string;
  songs: Song[];
  onSeeAll?: () => void;
}

export default function SongRow({ title, songs, onSeeAll }: SongRowProps) {
  if (songs.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {onSeeAll && (
          <button onClick={onSeeAll} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            Tout voir <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
        {songs.map(song => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </section>
  );
}
