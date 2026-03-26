import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from '@/pages/Login';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfileEdit from '@/pages/ProfileEdit';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import SearchPage from '@/pages/Search';
import Favorites from '@/pages/Favorites';
import Social from '@/pages/Social';
import UserProfile from '@/pages/UserProfile';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import MenuDrawer from '@/components/MenuDrawer';

function AppContent() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  const profileCompleted = user.profileCompleted || user.profilCompleted || false;

  const pathToActive: Record<string, 'home' | 'social' | 'search' | 'favorites'> = {
    '/jux': 'home',
    '/social': 'social',
    '/search': 'search',
    '/favorites': 'favorites',
    '/profile-edit': 'home',
    '/upload': 'home',
  };

  const active = pathToActive[location.pathname] || 'home';

  return (
    <PlayerProvider>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Navigate to="/jux" replace />} />
          <Route path="/jux" element={profileCompleted ? <Home /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/upload" element={profileCompleted ? <Upload /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/search" element={profileCompleted ? <SearchPage /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/favorites" element={profileCompleted ? <Favorites /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/social" element={profileCompleted ? <Social /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/profile/:userId" element={profileCompleted ? <UserProfile /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/profile-edit" element={profileCompleted ? <ProfileEdit onBack={() => navigate('/jux')} /> : <Navigate to="/profile-setup" replace />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
        </Routes>
        <MiniPlayer />
        <PlayerPage />
        <BottomNav
          active={active}
          onNavigate={(page) => navigate(page === 'home' ? '/jux' : `/${page}`)}
          onMenuOpen={() => setMenuOpen(true)}
        />
        <MenuDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEditProfile={() => navigate('/profile-edit')}
          onUpload={() => navigate('/upload')}
        />
      </div>
    </PlayerProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

