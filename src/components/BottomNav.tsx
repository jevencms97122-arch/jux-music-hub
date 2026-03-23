import { Home, Upload, Menu } from 'lucide-react';

interface BottomNavProps {
  active: 'home' | 'upload';
  onNavigate: (page: 'home' | 'upload') => void;
  onMenuOpen: () => void;
}

export default function BottomNav({ active, onNavigate, onMenuOpen }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around py-2">
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${active === 'home' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px]">Accueil</span>
        </button>
        <button
          onClick={() => onNavigate('upload')}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${active === 'upload' ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          <Upload className="h-5 w-5" />
          <span className="text-[10px]">Publier</span>
        </button>
        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center gap-0.5 px-4 py-1 text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </div>
    </nav>
  );
}
