import { Home, User, Search, Users, ListMusic } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'home' | 'search' | 'social' | 'playlists' | 'profile';

interface Props {
  active: Tab;
  onNavigate: (page: Tab) => void;
}

const items: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'home', label: 'Accueil', icon: Home },
  { key: 'search', label: 'Chercher', icon: Search },
  { key: 'social', label: 'Social', icon: Users },
  { key: 'playlists', label: 'Playlists', icon: ListMusic },
  { key: 'profile', label: 'Profil', icon: User },
];

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-3 left-3 right-3 z-40 safe-bottom">
      <div className="glass flex rounded-2xl">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold tracking-wide',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-gradient-primary" />
              )}
              <Icon
                className={cn('h-[18px] w-[18px]', isActive && 'drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]')}
                strokeWidth={isActive ? 2.2 : 1.7}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
