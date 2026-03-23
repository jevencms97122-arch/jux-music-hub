import { usePlayer } from '@/contexts/PlayerContext';
import { getSongCoverUrl } from '@/lib/pocketbase';
import { Volume2 } from 'lucide-react';

export default function QueueView() {
  const { queue, currentSong, playSong } = usePlayer();

  const currentIdx = queue.findIndex(s => s.id === currentSong?.id);
  const upcoming = queue.slice(currentIdx + 1);

  return (
    <div className="px-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          Lecture à partir de la file d'attente
        </p>
      </div>

      {currentSong && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary mb-2">
          <img src={getSongCoverUrl(currentSong)} alt="" className="h-10 w-10 rounded object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentSong.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentSong.author}</p>
          </div>
          <Volume2 className="h-4 w-4 text-primary flex-shrink-0" />
        </div>
      )}

      {upcoming.map((song, i) => (
        <button
          key={`${song.id}-${i}`}
          onClick={() => playSong(song, false)}
          className="flex w-full items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <img src={getSongCoverUrl(song)} alt="" className="h-10 w-10 rounded object-cover" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
            <p className="text-xs text-muted-foreground truncate">{song.author}</p>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{i + 1}</span>
        </button>
      ))}

      {upcoming.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun morceau à suivre</p>
      )}
    </div>
  );
}
