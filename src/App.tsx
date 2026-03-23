import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BrowserRouter } from 'react-router-dom';
import Login from '@/pages/Login';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfileEdit from '@/pages/ProfileEdit';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import SearchPage from '@/pages/Search';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import MenuDrawer from '@/components/MenuDrawer';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<'home' | 'upload' | 'search' | 'profile-edit'>('home');
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;
  const profileCompleted = user.profileCompleted || user.profilCompleted || false;
  if (!profileCompleted) return <ProfileSetup />;

  return (
    <PlayerProvider>
      <div className="min-h-screen">
        {page === 'home' && <Home />}
        {page === 'upload' && <Upload />}
        {page === 'search' && <SearchPage />}
        {page === 'profile-edit' && <ProfileEdit onBack={() => setPage('home')} />}
        <MiniPlayer />
        <PlayerPage />
        <BottomNav
          active={page === 'profile-edit' ? 'home' : page}
          onNavigate={setPage}
          onMenuOpen={() => setMenuOpen(true)}
        />
        <MenuDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEditProfile={() => setPage('profile-edit')}
        />
      </div>
    </PlayerProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
