import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAvatarUrl, pb } from '@/lib/pocketbase';
import { LogOut, User, UserCog, Upload, Settings, Music, ListMusic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Song, Playlist } from '@/types/music';
import SongCard from '@/components/SongCard';
import { usePlayer } from '@/contexts/PlayerContext';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const [userSongs, setUserSongs] = useState<Song[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [activeTab, setActiveTab] = useState<'songs' | 'playlists'>('songs');

  useEffect(() => {
    if (user) {
      // Load user songs
      pb.collection('songs').getFullList({
        filter: `uploadedBy="${user.id}"`,
        sort: '-created',
        expand: 'uploadedBy'
      }).then(s => setUserSongs(s as unknown as Song[]));

      // Load user playlists (excluding auto-playlist)
      pb.collection('playlists').getFullList({
        filter: `owner="${user.id}" && title!="Titres likés"`,
        sort: '-created',
        expand: 'songs'
      }).then(p => setUserPlaylists(p as unknown as Playlist[]));
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="pb-28 pt-4 px-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-bold text-xl">Mon profil</h2>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {user.avatar ? (
          <img src={getUserAvatarUrl(user as any)} alt={user.pseudo} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-lg font-bold text-foreground">{user.pseudo}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={() => navigate('/profile-edit')} className="text-xs bg-secondary px-3 py-1.5 rounded-md font-medium">Modifier le profil</button>
            <button onClick={() => navigate('/upload')} className="text-xs bg-secondary px-3 py-1.5 rounded-md font-medium"><Upload className="h-3 w-3" /></button>
            <button onClick={handleLogout} className="text-xs bg-destructive/10 text-destructive px-3 py-1.5 rounded-md font-medium"><LogOut className="h-3 w-3" /></button>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'songs'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground'
            }`}
          >
            <Music className="h-4 w-4" />
            Sons publiés ({userSongs.length})
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'playlists'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground'
            }`}
          >
            <ListMusic className="h-4 w-4" />
            Playlists ({userPlaylists.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'songs' ? (
          <div className="grid grid-cols-3 gap-1">
            {userSongs.map(s => (
              <div key={s.id} className="aspect-square">
                <SongCard song={s} size="sm" isActive={currentSong?.id === s.id} isPlaying={isPlaying} onPlay={playSong} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {userPlaylists.map((playlist, i) => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/playlist/${playlist.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <div className="h-14 w-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
                  {playlist.songs && playlist.songs.length > 0 ? (
                    <div className="grid grid-cols-2 gap-0.5 w-full h-full p-1">
                      {[0, 1, 2, 3].map(idx => (
                        <div key={idx} className="bg-muted rounded-sm" />
                      ))}
                    </div>
                  ) : (
                    <ListMusic className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground truncate">{playlist.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {playlist.songs?.length || 0} morceaux · {playlist.playCount} lectures
                  </p>
                </div>
              </motion.div>
            ))}
            {userPlaylists.length === 0 && (
              <div className="text-center py-8">
                <ListMusic className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucune playlist créée</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
