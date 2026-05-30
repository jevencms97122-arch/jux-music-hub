import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { preloadImages } from '@/lib/mediaCache';
import { pingPresence } from '@/lib/userPresence';
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
import CollabDetail from '@/pages/CollabDetail';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import UpdateChecker from '@/components/UpdateChecker';
import { Toaster } from '@/components/ui/sonner';

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

  // Pré-cache automatique des images visibles au chargement (mobile uniquement)
  useEffect(() => {
    if (loading) return;
    // Le pré-cache démarre après le rendu initial pour ne pas bloquer l'affichage
    const timer = setTimeout(() => {
      const images = document.querySelectorAll('img[src]');
      const urls: string[] = [];
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('http') && !src.includes('youtube') && !src.includes('ytimg')) {
          urls.push(src);
        }
      });
      if (urls.length > 0) {
        preloadImages(urls);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loading, user]);

  useEffect(() => {
    if (!user || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, [user, loading]);

  // Heartbeat : ping présence toutes les 3s tant que l'app est ouverte
  useEffect(() => {
    if (!authUser) return;
    // Ping immédiat au démarrage
    pingPresence(authUser.id);
    const interval = setInterval(() => {
      pingPresence(authUser.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [authUser]);

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
        {/* Vérification de mise à jour de l'app PC -- visible uniquement sur Jux Desktop */}
        {profileCompleted && <UpdateChecker />}
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
            <Route path="/collab/:username" element={guard(<CollabDetail />)} />
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
            onNavigate={(page) => {
              if (page === 'home') {
                navigate('/jux');
              } else {
                navigate(`/${page}`);
              }
            }}
          />
        )}
        <Toaster />
      </div>
    </PlayerProvider>
  );
}

function AppWithTheme() {
  const { currentTheme } = useTheme();

  // Si le thème a une animation, le fond animé est déjà géré via applyAnimationState() sur le body
  // On évite de mettre un background statique qui écraserait l'animation
  const isAnimated = currentTheme.backgroundAnimation != null;

  return (
    <div
      style={{
        background: isAnimated ? 'transparent' : currentTheme.background,
        backgroundSize: isAnimated ? '200% 200%' : undefined,
        animation: isAnimated ? currentTheme.backgroundAnimation : undefined,
        minHeight: '100vh',
      }}
      data-animated-bg={isAnimated ? '' : undefined}
    >
      <AppContent />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <AppWithTheme />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
