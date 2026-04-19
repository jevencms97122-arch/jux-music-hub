import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfilePage from '@/pages/ProfilePage';
import ProfileEdit from '@/pages/ProfileEdit';
import Playlists from '@/pages/Playlists';
import Social from '@/pages/Social';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';

function AppContent() {
  const { user, profile, loading } = useAuth();
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

  const profileCompleted = profile?.profile_completed ?? false;

  const pathToActive: Record<string, 'home' | 'social' | 'playlists' | 'profile'> = {
    '/jux': 'home',
    '/social': 'social',
    '/playlists': 'playlists',
    '/profile': 'profile',
    '/profile-edit': 'profile',
    '/upload': 'profile',
  };
  const active = pathToActive[location.pathname] || 'home';

  return (
    <PlayerProvider>
      <div className="min-h-screen">
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/jux" replace />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route
            path="/jux"
            element={profileCompleted ? <Home /> : <Navigate to="/profile-setup" replace />}
          />
          <Route
            path="/upload"
            element={profileCompleted ? <Upload /> : <Navigate to="/profile-setup" replace />}
          />
          <Route
            path="/playlists"
            element={profileCompleted ? <Playlists /> : <Navigate to="/profile-setup" replace />}
          />
          <Route
            path="/social"
            element={profileCompleted ? <Social /> : <Navigate to="/profile-setup" replace />}
          />
          <Route
            path="/profile"
            element={profileCompleted ? <ProfilePage /> : <Navigate to="/profile-setup" replace />}
          />
          <Route
            path="/profile-edit"
            element={profileCompleted ? <ProfileEdit onBack={() => navigate('/profile')} /> : <Navigate to="/profile-setup" replace />}
          />
          <Route path="*" element={<Navigate to="/jux" replace />} />
        </Routes>
        <MiniPlayer />
        <PlayerPage />
        {profileCompleted && (
          <BottomNav
            active={active}
            onNavigate={(page) => navigate(page === 'home' ? '/jux' : `/${page}`)}
          />
        )}
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
