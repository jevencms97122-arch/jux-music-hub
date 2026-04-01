import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Login from '@/pages/Login';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfileEdit from '@/pages/ProfileEdit';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Social from '@/pages/Social';
import UserProfile from '@/pages/UserProfile';
import ProfilePage from '@/pages/ProfilePage';
import SharedListen from '@/pages/SharedListen';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import { UpdateNotification } from '@/components/UpdateNotification';

function AppContent() {
  const { user, loading } = useAuth();
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

  // Allow shared listen page without authentication
  if (location.pathname.startsWith('/listen/')) {
    return (
      <PlayerProvider>
        <SharedListen />
      </PlayerProvider>
    );
  }

  if (!user) return <Login />;

  const profileCompleted = user.profileCompleted || user.profilCompleted || false;

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
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/jux" replace />} />
            <Route path="/jux" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <Home /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/upload" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <Upload /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/playlists" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <Playlists /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/playlist/:playlistId" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <PlaylistDetail /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/social" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <Social /> : <Navigate to="/social" replace />}
              </motion.div>
            } />
            <Route path="/profile" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <ProfilePage /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/profile/:userId" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <UserProfile /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/profile-edit" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                {profileCompleted ? <ProfileEdit onBack={() => navigate('/profile')} /> : <Navigate to="/profile-setup" replace />}
              </motion.div>
            } />
            <Route path="/profile-setup" element={
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <ProfileSetup />
              </motion.div>
            } />
          </Routes>
        </AnimatePresence>
        <MiniPlayer />
        <PlayerPage />
        <UpdateNotification />
        <BottomNav
          active={active}
          onNavigate={(page) => navigate(page === 'home' ? '/jux' : `/${page}`)}
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

