import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Heart, Music } from 'lucide-react';

export default function Favorites() {
  const { user } = useAuth();
  const { playSongFromList, currentSong, isPlaying } = usePlayer();
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const likes = await pb.collection('song_likes').getFullList({
          filter: `user="${user.id}"`,
          expand: 'song,song.uploadedBy',
          sort: '-created',
        });
        const songs: Song[] = likes
          .map((like: any) => like.expand?.song)
          .filter((song: Song | undefined) => song !== undefined);
        setFavoriteSongs(songs);
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setLoading(false);
      }
    };
    loadFavorites();
  }, [user]);

  const handlePlay = (song: Song) => {
    const idx = favoriteSongs.findIndex(s => s.id === song.id);
    playSongFromList(song, favoriteSongs, idx >= 0 ? idx : 0);
  };

  if (!user) {
    return (
      <div className="pb-28 pt-4 px-4 text-center py-8">
        <p className="text-muted-foreground">Connectez-vous pour voir vos favoris</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pb-28 pt-4 px-4 text-center py-8">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="pb-28 pt-6">
      <div className="px-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-primary/10 rounded-full">
            <Heart className="h-6 w-6 text-primary fill-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Favoris</h1>
            <p className="text-sm text-muted-foreground">{favoriteSongs.length} morceaux</p>
          </div>
        </div>
      </div>

      {favoriteSongs.length > 0 ? (
        <div className="px-4 grid grid-cols-1 gap-2">
          {favoriteSongs.map(s => (
            <div key={s.id} className="flex items-center p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <SongCard
                key={s.id}
                song={s}
                size="sm"
                isActive={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={handlePlay}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 text-center py-12">
          <div className="mx-auto w-16 h-16 bg-secondary flex items-center justify-center rounded-2xl mb-4">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Aucun favori</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Appuyez sur le cœur <Heart className="inline h-4 w-4" /> pour ajouter des morceaux à cette liste.
          </p>
        </div>
      )}
    </div>
  );
}
