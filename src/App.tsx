import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfilePage from '@/pages/ProfilePage';
import ProfileEdit from '@/pages/ProfileEdit';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Social from '@/pages/Social';
import UserProfile from '@/pages/UserProfile';
import Search from '@/pages/Search';
import Favorites from '@/pages/Favorites';
import Notifications from '@/pages/Notifications';
import CarMode from '@/pages/CarMode';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';

function AppContent() {
  const { user, profile, authUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, [user, loading]);

  // Toast notif temps réel
  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel('global-notif-' + authUser.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${authUser.id}`,
      }, (payload: any) => {
        const n = payload.new;
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(n.title, { body: n.body ?? '' });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser]);

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

  const guard = (el: JSX.Element) => profileCompleted ? el : <Navigate to="/profile-setup" replace />;

  return (
    <PlayerProvider>
      <div className="min-h-screen">
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/jux" replace />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/jux" element={guard(<Home />)} />
          <Route path="/upload" element={guard(<Upload />)} />
          <Route path="/playlists" element={guard(<Playlists />)} />
          <Route path="/playlist/:id" element={guard(<PlaylistDetail />)} />
          <Route path="/social" element={guard(<Social />)} />
          <Route path="/u/:userId" element={guard(<UserProfile />)} />
          <Route path="/search" element={guard(<Search />)} />
          <Route path="/favorites" element={guard(<Favorites />)} />
          <Route path="/notifications" element={guard(<Notifications />)} />
          <Route path="/car" element={guard(<CarMode />)} />
          <Route path="/profile" element={guard(<ProfilePage />)} />
          <Route path="/profile-edit" element={guard(<ProfileEdit onBack={() => navigate('/profile')} />)} />
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
