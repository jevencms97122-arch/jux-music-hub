import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb, getSongCoverUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Playlist, Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { ArrowLeft, Play, Shuffle, Globe, Lock, Music, Heart, Headphones, MoreVertical, Trash2, Eye, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

export default function PlaylistDetail() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSongFromList, currentSong, isPlaying } = usePlayer();
  const { toast } = useToast();
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadPlaylist = async () => {
      if (!playlistId) return;
      
      try {
        // Load playlist with expanded songs
        const playlistData = await pb.collection('playlists').getOne(playlistId, {
          expand: 'owner,songs,songs.uploadedBy',
        });
        setPlaylist(playlistData as unknown as Playlist);

        // Increment view count
        await pb.collection('playlists').update(playlistId, {
          'viewCount+': 1,
        });

        // Load songs from expanded data
        if (playlistData.expand?.songs && playlistData.expand.songs.length > 0) {
          setSongs(playlistData.expand.songs as unknown as Song[]);
        } else if (playlistData.songs && playlistData.songs.length > 0) {
          // Fallback: load songs manually if expand didn't work
          const songsData = await pb.collection('songs').getFullList({
            filter: playlistData.songs.map((id: string) => `id="${id}"`).join('||'),
            expand: 'uploadedBy',
          });
          setSongs(songsData as unknown as Song[]);
        }

        // Check if user has liked this playlist
        if (user) {
          const likeRecord = await pb.collection('playlist_likes').getList(1, 1, {
            filter: `user="${user.id}" && playlist="${playlistId}"`,
          });
          setIsLiked(likeRecord.items.length > 0);
        }
      } catch (error) {
        console.error('Error loading playlist:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger la playlist.",
          variant: "destructive",
        });
        // navigate('/playlists'); // Removed aggressive redirect
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [playlistId, user, navigate, toast]);

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playSongFromList(songs[0], songs, 0, playlistId);
    }
  };

  const handleShuffle = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      playSongFromList(shuffled[0], shuffled, 0, playlistId);
    }
  };

  const handleLikePlaylist = async () => {
    if (!user || !playlist) return;

    try {
      if (isLiked) {
        const likeRecord = await pb.collection('playlist_likes').getList(1, 1, {
          filter: `user="${user.id}" && playlist="${playlist.id}"`,
        });
        if (likeRecord.items[0]) {
          await pb.collection('playlist_likes').delete(likeRecord.items[0].id);
          setIsLiked(false);
          await pb.collection('playlists').update(playlist.id, {
            'likesCount-': 1,
          });
          setPlaylist(prev => prev ? { ...prev, likesCount: Math.max(0, prev.likesCount - 1) } : null);
        }
      } else {
        await pb.collection('playlist_likes').create({
          user: user.id,
          playlist: playlist.id,
        });
        setIsLiked(true);
        await pb.collection('playlists').update(playlist.id, {
          'likesCount+': 1,
        });
        setPlaylist(prev => prev ? { ...prev, likesCount: prev.likesCount + 1 } : null);
      }
    } catch (error) {
      console.error('Error toggling playlist like:', error);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!playlist || !user || playlist.owner !== user.id) return;

    try {
      const updatedSongs = playlist.songs.filter(id => id !== songId);
      await pb.collection('playlists').update(playlist.id, {
        songs: updatedSongs,
      });
      
      setPlaylist(prev => prev ? { ...prev, songs: updatedSongs } : null);
      setSongs(prev => prev.filter(s => s.id !== songId));
      
      toast({
        title: "Morceau retiré",
        description: "Le morceau a été retiré de la playlist.",
      });
    } catch (error) {
      console.error('Error removing song:', error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer le morceau.",
        variant: "destructive",
      });
    }
  };

  // Generate thumbnail grid
  const renderThumbnail = () => {
    if (!playlist || songs.length === 0) {
      return (
        <div className="w-full h-full bg-secondary flex items-center justify-center">
          <Music className="h-16 w-16 text-muted-foreground" />
        </div>
      );
    }

    if (playlist.thumbnailMode === 'single' || songs.length < 4) {
      return (
        <img
          src={getSongCoverUrl(songs[0])}
          alt={playlist.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
      );
    }

    return (
      <div className="grid grid-cols-2 gap-0.5 w-full h-full">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="overflow-hidden">
            {songs[i] ? (
              <img
                src={getSongCoverUrl(songs[i])}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="pb-28 pt-4 px-4 text-center py-8">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  if (!playlist) {
    return null;
  }

  const isOwner = user && playlist.owner === user.id;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-64 overflow-hidden">
          {songs.length > 0 && (
            <img
              src={getSongCoverUrl(songs[0])}
              alt=""
              className="w-full h-full object-cover blur-3xl opacity-30"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-background" />
        </div>

        <div className="relative px-4 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          <div className="mt-6 flex gap-4">
            <div className="w-32 h-32 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
              {renderThumbnail()}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground mb-1 truncate">{playlist.title}</h1>
              {playlist.description && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{playlist.description}</p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                {playlist.public ? (
                  <Globe className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                <span>{playlist.public ? 'Publique' : 'Privée'}</span>
                <span>·</span>
                <span>{songs.length} morceaux</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{playlist.viewCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Headphones className="h-3.5 w-3.5" />
                  <span>{playlist.playCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-primary text-primary' : ''}`} />
                  <span>{playlist.likesCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handlePlayAll}
              disabled={songs.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-5 w-5 fill-current" />
              Tout lire
            </button>
            <button
              onClick={handleShuffle}
              disabled={songs.length === 0}
              className="p-3 bg-secondary rounded-xl text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shuffle className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/playlist/${playlist.id}`;
                navigator.clipboard.writeText(url);
                toast({ title: "Lien copié", description: "Le lien de la playlist a été copié." });
              }}
              className="p-3 bg-secondary rounded-xl text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Share2 className="h-5 w-5" />
            </button>
            {!isOwner && (
              <button
                onClick={handleLikePlaylist}
                className={`p-3 rounded-xl transition-colors ${
                  isLiked 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Songs list */}
      <div className="px-4 mt-6">
        {/* On vérifie la variable 'songs' qui contient soit l'expand, soit le fallback */}
        {songs && songs.length > 0 ? (
          <div className="space-y-2">
            {songs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                <span className="w-6 text-center text-sm text-muted-foreground">{index + 1}</span>
                <div className="flex-1">
                  <SongCard
                    song={song}
                    size="sm"
                    isActive={currentSong?.id === song.id}
                    isPlaying={isPlaying}
                    onPlay={(s) => playSongFromList(s, songs, index, playlistId)}
                  />
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleRemoveSong(song.id)}
                    className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-secondary flex items-center justify-center rounded-2xl mb-4">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Playlist vide</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Ajoutez des morceaux à cette playlist pour commencer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}