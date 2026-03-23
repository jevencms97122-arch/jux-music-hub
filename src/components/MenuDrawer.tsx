import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAvatarUrl } from '@/lib/pocketbase';
import { LogOut, User, UserCog } from 'lucide-react';

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}

export default function MenuDrawer({ open, onClose, onEditProfile }: MenuDrawerProps) {
  const { user, logout } = useAuth();

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
            onClick={() => { logout(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
