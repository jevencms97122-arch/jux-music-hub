import { Home, Users, ListMusic, User } from 'lucide-react';

interface Props {
  active: 'home' | 'social' | 'playlists' | 'profile';
  onNavigate: (page: 'home' | 'social' | 'playlists' | 'profile') => void;
}

const items = [
  { key: 'home', label: 'Accueil', icon: Home },
  { key: 'social', label: 'Social', icon: Users },
  { key: 'playlists', label: 'Playlists', icon: ListMusic },
  { key: 'profile', label: 'Profil', icon: User },
] as const;

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <ul className="grid grid-cols-4">
        {items.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <button
              onClick={() => onNavigate(key)}
              className={`flex w-full flex-col items-center gap-1 py-2 text-xs ${
                active === key ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
