import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import ListenTogether from '@/pages/ListenTogether';
import Wrapped from '@/pages/Wrapped';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 },
};

const PageWrap = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={{ duration: 0.22, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

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
        // Toast in-app + bouton rejoindre pour invitation session
        if (n.type === 'session_invite') {
          const code = n.data?.code;
          toast(n.title, {
            description: n.body,
            duration: 15000,
            action: code ? {
              label: 'Rejoindre',
              onClick: () => navigate(`/listen-together?code=${code}`),
            } : undefined,
          });
        } else {
          toast(n.title, { description: n.body ?? undefined });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser, navigate]);

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
    '/wrapped': 'profile',
  };
  const active = pathToActive[location.pathname] || 'home';

  const guard = (el: JSX.Element) => profileCompleted ? <PageWrap>{el}</PageWrap> : <Navigate to="/profile-setup" replace />;

  return (
    <PlayerProvider>
      <div className="min-h-screen">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/jux" replace />} />
            <Route path="/profile-setup" element={<PageWrap><ProfileSetup /></PageWrap>} />
            <Route path="/jux" element={guard(<Home />)} />
            <Route path="/upload" element={guard(<Upload />)} />
            <Route path="/playlists" element={guard(<Playlists />)} />
            <Route path="/playlist/:id" element={guard(<PlaylistDetail />)} />
            <Route path="/social" element={guard(<Social />)} />
            <Route path="/listen-together" element={guard(<ListenTogether />)} />
            <Route path="/u/:userId" element={guard(<UserProfile />)} />
            <Route path="/search" element={guard(<Search />)} />
            <Route path="/favorites" element={guard(<Favorites />)} />
            <Route path="/notifications" element={guard(<Notifications />)} />
            <Route path="/car" element={guard(<CarMode />)} />
            <Route path="/wrapped" element={guard(<Wrapped />)} />
            <Route path="/profile" element={guard(<ProfilePage />)} />
            <Route path="/profile-edit" element={guard(<ProfileEdit onBack={() => navigate('/profile')} />)} />
            <Route path="*" element={<Navigate to="/jux" replace />} />
          </Routes>
        </AnimatePresence>
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
