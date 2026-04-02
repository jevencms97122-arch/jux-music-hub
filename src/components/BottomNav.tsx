import { Home, User, ListMusic, Users, Bell } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface BottomNavProps {
  active: 'home' | 'social' | 'playlists' | 'profile';
  onNavigate: (page: 'home' | 'social' | 'playlists' | 'profile') => void;
  onNotifications: () => void;
}

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-lg border-t border-border/50 safe-bottom">
      <div className="flex items-center justify-around py-2 pb-safe">
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 transition-all ${active === 'home' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Home className={`h-6 w-6 ${active === 'home' ? 'fill-primary/20' : ''}`} />
          <span className="text-[10px] font-medium">Accueil</span>
        </button>
        <button
          onClick={() => onNavigate('playlists')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 transition-all ${active === 'playlists' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <ListMusic className={`h-6 w-6 ${active === 'playlists' ? 'fill-primary/20' : ''}`} />
          <span className="text-[10px] font-medium">Playlists</span>
        </button>
        <button
          onClick={() => onNavigate('social')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 transition-all ${active === 'social' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Users className={`h-6 w-6 ${active === 'social' ? 'fill-primary/20' : ''}`} />
          <span className="text-[10px] font-medium">Social</span>
        </button>
        <button
          onClick={() => onNavigate('profile')}
          className={`flex flex-col items-center gap-1 px-3 py-1.5 transition-all ${active === 'profile' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <User className={`h-6 w-6 ${active === 'profile' ? 'fill-primary/20' : ''}`} />
          <span className="text-[10px] font-medium">Profil</span>
        </button>
      </div>
    </nav>
  );
}

