import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import type { Song } from '@/types/music';
import juxLogo from '@/assets/jux-logo.png';

export default function Home() {
  const { playSongFromList } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) console.error(error);
      setSongs((data ?? []) as Song[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen pb-40">
      <header className="flex items-center justify-between p-4">
        <img src={juxLogo} alt="Jux" className="h-8" />
      </header>

      <section className="px-4">
        <h2 className="mb-3 text-lg font-bold text-foreground">Découvre</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-secondary" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune musique pour l'instant. Sois le premier à uploader !
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s) => (
              <SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
