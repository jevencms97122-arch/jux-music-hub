import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAvatarUrl, pb } from '@/lib/pocketbase';
import { LogOut, User, UserCog, Upload, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { usePlayer } from '@/contexts/PlayerContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const navigate = useNavigate();
  const [userSongs, setUserSongs] = useState<Song[]>([]);

  useEffect(() => {
    if (user) {
      pb.collection('songs').getFullList({
        filter: `uploadedBy="${user.id}"`,
        sort: '-created',
        expand: 'uploadedBy'
      }).then(s => setUserSongs(s as unknown as Song[]));
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
        <h3 className="font-semibold mb-3">Sons publiés ({userSongs.length})</h3>
        <div className="grid grid-cols-3 gap-1">
          {userSongs.map(s => (
            <div key={s.id} className="aspect-square">
              <SongCard song={s} size="sm" isActive={currentSong?.id === s.id} isPlaying={isPlaying} onPlay={playSong} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
