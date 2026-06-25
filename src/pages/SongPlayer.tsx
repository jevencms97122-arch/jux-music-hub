import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { recordToSong } from '@/lib/pbUtils';
import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';
import { Play } from 'lucide-react';

export default function SongPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong, openPlayer } = usePlayer();
  const done = useRef(false);

  const [song, setSong] = useState<Song | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || done.current) return;
    done.current = true;
    (async () => {
      try {
        const record = await pb.collection('songs').getOne(id);
        setSong(recordToSong(record));
      } catch {
        setError(true);
        setTimeout(() => navigate('/jux', { replace: true }), 2000);
      }
    })();
  }, [id, navigate]);

  const handlePlay = () => {
    if (!song) return;
    playSong(song);
    openPlayer();
    navigate('/jux', { replace: true });
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Musique introuvable…</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 bg-background">
      <img
        src={songCoverUrl(song)}
        alt={song.title}
        className="w-48 h-48 rounded-2xl shadow-2xl object-cover"
      />
      <div className="text-center space-y-1">
        <p className="text-xl font-bold text-foreground">{song.title}</p>
        <p className="text-base text-muted-foreground">{song.author}</p>
      </div>
      <button
        onClick={handlePlay}
        className="flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-primary-foreground font-semibold text-lg shadow-lg active:scale-95 transition-transform"
      >
        <Play className="h-6 w-6 fill-current" />
        Écouter
      </button>
      <p className="text-xs text-muted-foreground">Nexora-Music</p>
    </div>
  );
}
