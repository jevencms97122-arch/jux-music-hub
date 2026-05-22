import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import type { Song } from '@/types/music';

export default function Favorites() {
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const { data: likes } = await supabase
        .from('song_likes')
        .select('song_id')
        .eq('user_id', authUser.id);
      const ids = (likes ?? []).map((l) => l.song_id);
      if (ids.length === 0) { setSongs([]); setLoading(false); return; }
      const { data } = await supabase.from('songs').select('*').in('id', ids);
      setSongs((data ?? []) as Song[]);
      setLoading(false);
    })();
  }, [authUser]);

  return (
    <div className="min-h-screen px-4 py-6 pb-40">
      <h1 className="mb-4 text-xl font-bold" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>Titres likés</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.1s' }}>Chargement...</p>
      ) : songs.length === 0 ? (
        <p className="text-sm text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.1s' }}>Aucun titre liké pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {songs.map((s, i) => (
            <div key={s.id} style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.1 + i * 0.04}s` }}>
              <SongCard song={s} onPlay={() => playSongFromList(s, songs)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}