import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import type { Song } from '@/types/music';
import SongRow from '@/components/SongRow';
import SongCard from '@/components/SongCard';
import { Heart } from 'lucide-react';

export default function Favorites() {
  const { user } = useAuth();
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get all song likes for the current user
        const likes = await pb.collection('song_likes').getFullList({
          filter: `user="${user.id}"`,
          expand: 'song,song.uploadedBy',
          sort: '-created'
        });

        // Extract songs from the likes
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

  if (!user) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center gap-3 px-4 mb-4">
          <h1 className="text-xl font-bold text-foreground">Favoris</h1>
        </div>
        <div className="px-4 text-center py-8">
          <p className="text-muted-foreground">Connectez-vous pour voir vos favoris</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center gap-3 px-4 mb-4">
          <h1 className="text-xl font-bold text-foreground">Favoris</h1>
        </div>
        <div className="px-4 text-center py-8">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        </div>
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
        <SongRow title="Vos morceaux likés" songs={favoriteSongs} />
      ) : (
        <div className="px-4 text-center py-8">
          <p className="text-muted-foreground">Aucun favori pour le moment</p>
          <p className="text-sm text-muted-foreground mt-2">Appuyez sur le cœur ❤️ sur les morceaux que vous aimez pour les ajouter à vos favoris</p>
        </div>
      )}
    </div>
  );
}