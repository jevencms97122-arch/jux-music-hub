import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAvatarUrl, pb } from '@/lib/pocketbase';
import { LogOut, User, UserCog, Upload, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { usePlayer } from '@/contexts/PlayerContext';

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onUpload: () => void;
}

export default function MenuDrawer({ open, onClose, onEditProfile, onUpload }: MenuDrawerProps) {
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
    onClose();
    navigate('/');
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="bg-card border-border w-full sm:w-96 p-0 overflow-y-auto">
        <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="font-bold text-lg">Mon compte</h2>
            <button onClick={() => { onClose(); }} className="text-muted-foreground"><Settings /></button>
        </div>

        {user && (
          <div className="p-4">
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
                <div className="flex gap-2 mt-2">
                    <button onClick={() => { onEditProfile(); onClose(); }} className="text-xs bg-secondary px-3 py-1.5 rounded-md font-medium">Modifier le profil</button>
                    <button onClick={() => { onUpload(); onClose(); }} className="text-xs bg-secondary px-3 py-1.5 rounded-md font-medium"><Upload className="h-3 w-3" /></button>
                    <button onClick={handleLogout} className="text-xs bg-destructive/10 text-destructive px-3 py-1.5 rounded-md font-medium"><LogOut className="h-3 w-3" /></button>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-semibold mb-3">Sons publiés ({userSongs.length})</h3>
              <div className="grid grid-cols-2 gap-2">
                {userSongs.map(s => (
                  <SongCard key={s.id} song={s} size="sm" isActive={currentSong?.id === s.id} isPlaying={isPlaying} onPlay={playSong} />
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
