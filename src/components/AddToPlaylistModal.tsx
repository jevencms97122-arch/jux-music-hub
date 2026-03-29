import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import type { Playlist, Song } from '@/types/music';
import { X, Plus, ListMusic, Music, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onPlaylistCreated?: () => void;
}

export default function AddToPlaylistModal({ isOpen, onClose, song, onPlaylistCreated }: AddToPlaylistModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadPlaylists();
    }
  }, [isOpen, user]);

  const loadPlaylists = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const result = await pb.collection('playlists').getFullList({
        filter: `owner="${user.id}"`,
        sort: '-created',
      });
      setPlaylists(result as unknown as Playlist[]);
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlist: Playlist) => {
    if (!song || !user || addingToPlaylist) return;

    // Check if song is already in playlist
    if (playlist.songs.includes(song.id)) {
      toast({
        title: "Déjà dans la playlist",
        description: "Ce morceau est déjà dans cette playlist.",
        variant: "default",
      });
      return;
    }

    setAddingToPlaylist(playlist.id);
    try {
      const updatedSongs = [...playlist.songs, song.id];
      await pb.collection('playlists').update(playlist.id, {
        songs: updatedSongs,
      });

      setPlaylists(prev => prev.map(p => 
        p.id === playlist.id 
          ? { ...p, songs: updatedSongs }
          : p
      ));

      toast({
        title: "Ajouté à la playlist",
        description: `"${song.title}" a été ajouté à "${playlist.title}".`,
      });
      
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le morceau à la playlist.",
        variant: "destructive",
      });
    } finally {
      setAddingToPlaylist(null);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!user || !newPlaylistTitle.trim()) return;

    try {
      const newPlaylist = await pb.collection('playlists').create({
        title: newPlaylistTitle.trim(),
        description: '',
        public: true,
        owner: user.id,
        songs: song ? [song.id] : [],
        viewCount: 0,
        playCount: 0,
        likesCount: 0,
        thumbnailMode: 'single',
      });

      setPlaylists(prev => [newPlaylist as unknown as Playlist, ...prev]);
      setShowCreateForm(false);
      setNewPlaylistTitle('');
      
      toast({
        title: "Playlist créée",
        description: song 
          ? `"${song.title}" a été ajouté à la nouvelle playlist.`
          : "Votre playlist a été créée avec succès.",
      });

      if (onPlaylistCreated) {
        onPlaylistCreated();
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la playlist.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">
              {playlists.length === 0 && !showCreateForm 
                ? 'Créer une playlist' 
                : 'Ajouter à une playlist'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* No playlists message */}
            {playlists.length === 0 && !showCreateForm && (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-secondary flex items-center justify-center rounded-2xl mb-4">
                  <ListMusic className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Vous n'avez pas encore de playlist
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Créez votre première playlist pour organiser vos morceaux.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Créer une playlist
                </button>
              </div>
            )}

            {/* Create form */}
            {showCreateForm && (
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    placeholder="Nom de la playlist"
                    className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistTitle.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Créer
                  </button>
                </div>
                {playlists.length > 0 && (
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewPlaylistTitle('');
                    }}
                    className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Annuler
                  </button>
                )}
              </div>
            )}

            {/* Playlists list */}
            {playlists.length > 0 && !showCreateForm && (
              <>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors mb-3"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">Nouvelle playlist</span>
                </button>

                <div className="space-y-2">
                  {playlists.map(playlist => {
                    const hasSongAlready = song && playlist.songs.includes(song.id);
                    const isAdding = addingToPlaylist === playlist.id;
                    
                    return (
                      <button
                        key={playlist.id}
                        onClick={() => !hasSongAlready && handleAddToPlaylist(playlist)}
                        disabled={hasSongAlready || isAdding}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          hasSongAlready 
                            ? 'bg-secondary/30 cursor-not-allowed' 
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          {playlist.songs.length > 0 ? (
                            <div className="grid grid-cols-2 gap-0.5 w-full h-full p-1">
                              {[0, 1, 2, 3].map(i => (
                                <div key={i} className="bg-muted rounded-sm" />
                              ))}
                            </div>
                          ) : (
                            <Music className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-foreground truncate">{playlist.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {playlist.songs.length} morceaux
                          </p>
                        </div>
                        {hasSongAlready ? (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : isAdding ? (
                          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}