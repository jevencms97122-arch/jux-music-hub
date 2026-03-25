import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAvatarUrl } from '@/lib/pocketbase';
import { LogOut, User, UserCog, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onUpload: () => void;
}

export default function MenuDrawer({ open, onClose, onEditProfile, onUpload }: MenuDrawerProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="bg-card border-border w-72">
        <SheetHeader>
          <SheetTitle className="text-foreground">Menu</SheetTitle>
        </SheetHeader>

        {user && (
          <div className="flex items-center gap-3 px-2 py-4 mt-4 border-b border-border">
            {user.avatar ? (
              <img src={getUserAvatarUrl(user as any)} alt={user.pseudo} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{user.pseudo}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-1 px-2">
          <button
            onClick={() => { onEditProfile(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <UserCog className="h-4 w-4" />
            Modifier le profil
          </button>
          <button
            onClick={() => { onUpload(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Upload className="h-4 w-4" />
            Publier une musique
          </button>
          <div className="border-t border-border my-2" />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-secondary transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
