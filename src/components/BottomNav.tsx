import { Home, User } from 'lucide-react';

interface Props {
  active: 'home' | 'profile';
  onNavigate: (page: 'home' | 'profile') => void;
}

const items = [
  { key: 'home', label: 'Accueil', icon: Home },
  { key: 'profile', label: 'Profil', icon: User },
] as const;

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-2 left-3 right-3 z-40 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-2xl safe-bottom shadow-soft">
      <ul className="grid grid-cols-2">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <li key={key}>
              <button
                onClick={() => onNavigate(key)}
                className={`relative flex w-full flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-all duration-300 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <>
                    <span className="absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gradient-primary" />
                    <span className="absolute inset-1 rounded-xl bg-primary/5" />
                  </>
                )}
                <div className={`relative z-10 flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                  <Icon className={`h-5 w-5 transition-all duration-300 ${isActive ? 'text-primary' : ''}`} />
                </div>
                <span className="relative z-10">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
