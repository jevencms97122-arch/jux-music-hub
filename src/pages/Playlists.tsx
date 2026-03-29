import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb, getSongCoverUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Playlist, Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Heart, Music, Plus, ListMusic, Lock, Globe, Play, Trash2, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

export default function Playlists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSongFromList, currentSong, isPlaying } = usePlayer();
  const { toast } = useToast();
  
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);
  const [playlistSongs, setPlaylistSongs] = useState<Record<string, Song[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingSongs, setEditingSongs] = useState<Song[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    public: true,
    thumbnailOrder: [] as string[] // Now stores image URLs instead of indices
  });

  // Helper function to parse thumbnailOrder (now contains image URLs)
  const parseThumbnailOrder = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Helper function to get ordered thumbnail URL for display (single mode only)
  const getThumbnailUrl = (songs: Song[], playlist: Playlist): string | null => {
    if (!songs || songs.length === 0) return null;
    
    const urls = parseThumbnailOrder(playlist.thumbnailOrder);
    
    // If we have stored URL, use it
    if (urls && urls.length > 0) {
      return urls[0];
    }
    
    // Fallback: generate URL from first song
    return getSongCoverUrl(songs[0]);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) { setLoading(false); return; }
      try {
        // Load liked songs
        const likes = await pb.collection('song_likes').getFullList({
          filter: `user="${user.id}"`,
          expand: 'song,song.uploadedBy',
          sort: '-created',
        });
        const songs: Song[] = likes
          .map((like: any) => like.expand?.song)
          .filter((song: Song | undefined) => song !== undefined);
        setLikedSongs(songs);

        // Load user playlists (excluding the auto-playlist)
        const playlists = await pb.collection('playlists').getFullList({
          filter: `owner="${user.id}" && title!="Titres likés"`,
          sort: '-created',
        });
        setUserPlaylists(playlists as unknown as Playlist[]);

        // Load songs for each playlist to get thumbnails
        const songsMap: Record<string, Song[]> = {};
        for (const playlist of playlists) {
          if (playlist.songs && playlist.songs.length > 0) {
            try {
              // Always load all songs to respect thumbnailOrder
              const songsData = await pb.collection('songs').getFullList({
                filter: playlist.songs.map((id: string) => `id="${id}"`).join('||'),
              });
              // Sort songs to match the order of IDs in playlist.songs
              const sortedSongs = playlist.songs.map((id: string) => 
                songsData.find((s: any) => s.id === id)
              ).filter(Boolean);
              songsMap[playlist.id] = sortedSongs as unknown as Song[];
            } catch (e) {
              console.error('Error loading playlist songs:', e);
            }
          }
        }

        // Ensure "Titres likés" playlist exists
        const likedPlaylist = await pb.collection('playlists').getList(1, 1, {
          filter: `owner="${user.id}" && title="Titres likés"`,
        });

        if (likedPlaylist.items.length === 0 && songs.length > 0) {
          // Create the auto-playlist if it doesn't exist
          await pb.collection('playlists').create({
            title: 'Titres likés',
            description: 'Vos morceaux favoris automatiquement ajoutés',
            public: false,
            owner: user.id,
            songs: songs.map(s => s.id),
            viewCount: 0,
            playCount: 0,
            likesCount: 0,
            thumbnailMode: 'grid',
          });
        }

        // Load saved playlists (playlists liked by user)
        const savedLikes = await pb.collection('playlist_likes').getFullList({
          filter: `user="${user.id}"`,
          expand: 'playlist,playlist.owner',
        });
        const saved = savedLikes
          .map((like: any) => like.expand?.playlist)
          .filter((p: Playlist | undefined) => p !== undefined);
        setSavedPlaylists(saved as Playlist[]);
        
        // Load songs for saved playlists to display thumbnails correctly
        for (const playlist of saved) {
          if (playlist.songs && playlist.songs.length > 0 && !songsMap[playlist.id]) {
            try {
              const songsData = await pb.collection('songs').getFullList({
                filter: playlist.songs.map((id: string) => `id="${id}"`).join('||'),
              });
              // Sort songs to match the order of IDs in playlist.songs
              const sortedSongs = playlist.songs.map((id: string) => 
                songsData.find((s: any) => s.id === id)
              ).filter(Boolean);
              songsMap[playlist.id] = sortedSongs as unknown as Song[];
            } catch (e) {
              console.error('Error loading saved playlist songs:', e);
            }
          }
        }
        
        // Update state with all loaded songs
        setPlaylistSongs(songsMap);
      } catch (error) {
        console.error('Error loading playlists:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handlePlayLikedSongs = () => {
    if (likedSongs.length > 0) {
      playSongFromList(likedSongs[0], likedSongs, 0);
    }
  };

  const handlePlayPlaylist = async (playlist: Playlist) => {
    try {
      // Increment play count
      await pb.collection('playlists').update(playlist.id, {
        'playCount+': 1
      });

      // Get full songs data
      const songsData = await pb.collection('songs').getFullList({
        filter: playlist.songs.map(id => `id="${id}"`).join('||'),
        expand: 'uploadedBy',
      });

      if (songsData.length > 0) {
        playSongFromList(songsData[0] as unknown as Song, songsData as unknown as Song[], 0);
      }
    } catch (error) {
      console.error('Error playing playlist:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!user || !formData.title.trim()) return;

    try {
      const newPlaylist = await pb.collection('playlists').create({
        title: formData.title.trim(),
        description: formData.description.trim(),
        public: formData.public,
        owner: user.id,
        songs: [],
        viewCount: 0,
        playCount: 0,
        likesCount: 0,
        thumbnailMode: 'single',
        thumbnailOrder: JSON.stringify(formData.thumbnailOrder),
      });

      setUserPlaylists(prev => [newPlaylist as unknown as Playlist, ...prev]);
      setShowCreateModal(false);
      setFormData({ title: '', description: '', public: true, thumbnailOrder: [] });
      
      toast({
        title: "Playlist créée",
        description: "Votre playlist a été créée avec succès.",
      });
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la playlist.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePlaylist = async () => {
    if (!selectedPlaylist || !formData.title.trim()) return;

    try {
      await pb.collection('playlists').update(selectedPlaylist.id, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        public: formData.public,
        thumbnailMode: 'single',
        thumbnailOrder: JSON.stringify(formData.thumbnailOrder),
      });

      setUserPlaylists(prev => prev.map(p => 
        p.id === selectedPlaylist.id 
          ? { ...p, ...formData }
          : p
      ));
      
      setEditMode(false);
      setSelectedPlaylist(null);
      setFormData({ title: '', description: '', public: true, thumbnailOrder: [] });
      
      toast({
        title: "Playlist mise à jour",
        description: "Votre playlist a été modifiée avec succès.",
      });
    } catch (error) {
      console.error('Error updating playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la playlist.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette playlist ?')) return;

    try {
      await pb.collection('playlists').delete(playlistId);
      setUserPlaylists(prev => prev.filter(p => p.id !== playlistId));
      
      toast({
        title: "Playlist supprimée",
        description: "Votre playlist a été supprimée.",
      });
    } catch (error) {
      console.error('Error deleting playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la playlist.",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setFormData({
      title: playlist.title,
      description: playlist.description,
      public: playlist.public,
      thumbnailOrder: parseThumbnailOrder(playlist.thumbnailOrder),
    });
    
    // Load songs for this playlist to show them in edit modal
    if (playlistSongs[playlist.id]) {
      setEditingSongs(playlistSongs[playlist.id]);
    }
    
    setEditMode(true);
  };

  if (!user) {
    return (
      <div className="pb-28 pt-4 px-4 text-center py-8">
        <p className="text-muted-foreground">Connectez-vous pour voir vos playlists</p>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-full">
              <ListMusic className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Playlists</h1>
              <p className="text-sm text-muted-foreground">{userPlaylists.length + 1} playlists</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-3 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Auto playlist: Titres likés */}
      <div className="px-4 mb-6">
        <div
          onClick={handlePlayLikedSongs}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-4 cursor-pointer hover:from-primary/30 hover:to-primary/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-primary/20 flex items-center justify-center">
              <Heart className="h-8 w-8 text-primary fill-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">Titres likés</h3>
              <p className="text-sm text-muted-foreground">{likedSongs.length} morceaux</p>
            </div>
            <button className="p-2 bg-primary rounded-full text-primary-foreground">
              <Play className="h-5 w-5 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* User playlists */}
      {userPlaylists.length > 0 ? (
        <div className="px-4 space-y-3">
          {userPlaylists.map(playlist => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-3 rounded-xl bg-card hover:bg-secondary/50 transition-colors"
            >
              <div
                onClick={() => handlePlayPlaylist(playlist)}
                className="relative h-14 w-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center cursor-pointer flex-shrink-0"
              >
                {playlistSongs[playlist.id] && playlistSongs[playlist.id].length > 0 ? (
                  (() => {
                    const thumbUrl = getThumbnailUrl(playlistSongs[playlist.id], playlist);
                    return thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="h-6 w-6 text-muted-foreground" />
                    );
                  })()
                ) : (
                  <Music className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              
              <div
                onClick={() => navigate(`/playlist/${playlist.id}`)}
                className="flex-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{playlist.title}</h3>
                  {playlist.public ? (
                    <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {playlist.songs?.length || 0} morceaux · {playlist.playCount} lectures
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(playlist); }}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(playlist.id); }}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="px-4 text-center py-12">
          <div className="mx-auto w-16 h-16 bg-secondary flex items-center justify-center rounded-2xl mb-4">
            <ListMusic className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Aucune playlist</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Créez votre première playlist en appuyant sur le bouton +.
          </p>
        </div>
      )}

      {/* Saved playlists */}
      {savedPlaylists.length > 0 && (
        <div className="px-4 mt-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Playlists enregistrées</h2>
          <div className="space-y-3">
            {savedPlaylists.map(playlist => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 p-3 rounded-xl bg-card hover:bg-secondary/50 transition-colors"
              >
                <div
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                  className="relative h-14 w-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center cursor-pointer flex-shrink-0"
                >
                  {playlistSongs[playlist.id] && playlistSongs[playlist.id].length > 0 ? (
                    (() => {
                      const thumbUrl = getThumbnailUrl(playlistSongs[playlist.id], playlist);
                      return thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-6 w-6 text-muted-foreground" />
                      );
                    })()
                  ) : (
                    <Music className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                
                <div
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <h3 className="font-semibold text-foreground truncate">{playlist.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {playlist.expand?.owner?.pseudo || 'Utilisateur'} · {playlist.songs?.length || 0} morceaux
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editMode) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              setShowCreateModal(false);
              setEditMode(false);
              setSelectedPlaylist(null);
              setEditingSongs([]);
              setFormData({ title: '', description: '', public: true, thumbnailOrder: [] });
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-foreground mb-4">
                {editMode ? 'Modifier la playlist' : 'Nouvelle playlist'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    Titre *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Nom de la playlist"
                    maxLength={255}
                    className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Décrivez votre playlist (optionnel)"
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.description.length}/500
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Visibilité
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, public: !prev.public }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.public ? 'bg-primary' : 'bg-secondary'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.public ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  {formData.public ? 'Visible par tous' : 'Privée (visible uniquement par vous)'}
                </p>



                {/* Thumbnail selection */}
                {editingSongs.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Choisir la pochette
                    </label>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {editingSongs.slice(0, 12).map((song, idx) => {
                        const songUrl = getSongCoverUrl(song);
                        const isSelected = formData.thumbnailOrder[0] === songUrl;
                        return (
                          <button
                            key={idx}
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              thumbnailOrder: [songUrl]
                            }))}
                            className={`relative h-16 rounded-lg overflow-hidden transition-all border-2 ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary'
                                : 'border-transparent'
                            }`}
                          >
                            <img
                              src={songUrl}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditMode(false);
                    setSelectedPlaylist(null);
                    setEditingSongs([]);
                    setFormData({ title: '', description: '', public: true, thumbnailOrder: [] });
                  }}
                  className="flex-1 py-2 px-4 rounded-lg bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={editMode ? handleUpdatePlaylist : handleCreatePlaylist}
                  disabled={!formData.title.trim()}
                  className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editMode ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}