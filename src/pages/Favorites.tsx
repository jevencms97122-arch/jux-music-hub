import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Heart } from 'lucide-react';

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
    <div className="pb-28">
      <div className="flex items-center gap-3 px-4 py-4">
        <Heart className="h-8 w-8 text-primary fill-primary" />
        <h1 className="text-xl font-bold text-foreground">Favoris</h1>
      </div>

      {favoriteSongs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4">
          {favoriteSongs.map(s => (
            <SongCard
              key={s.id}
              song={s}
              size="sm"
              isActive={currentSong?.id === s.id}
              isPlaying={isPlaying}
              onPlay={handlePlay}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 text-center py-8">
          <p className="text-muted-foreground">Aucun favori pour le moment</p>
          <p className="text-sm text-muted-foreground mt-2">Appuyez sur le cœur ❤️ pour ajouter des favoris</p>
        </div>
      )}
    </div>
  );
}
