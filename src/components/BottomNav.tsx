import { Home, Users, ListMusic, User, Music2 } from 'lucide-react';

interface Props {
  active: 'home' | 'social' | 'playlists' | 'profile' | 'collabs';
  onNavigate: (page: 'home' | 'social' | 'playlists' | 'profile' | 'collabs') => void;
}

const items = [
  { key: 'home', label: 'Accueil', icon: Home },
  { key: 'collabs', label: 'Collabs', icon: Music2 },
  { key: 'social', label: 'Social', icon: Users },
  { key: 'playlists', label: 'Playlists', icon: ListMusic },
  { key: 'profile', label: 'Profil', icon: User },
] as const;

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-xl safe-bottom">
      <ul className="grid grid-cols-5">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <li key={key}>
              <button
                onClick={() => onNavigate(key)}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gradient-primary" />
                )}
                <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
