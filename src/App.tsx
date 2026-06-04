import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { preloadImages } from '@/lib/mediaCache';
import { pingPresence } from '@/lib/userPresence';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfilePage from '@/pages/ProfilePage';
import ProfileEdit from '@/pages/ProfileEdit';
import UserProfile from '@/pages/UserProfile';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import UpdateChecker from '@/components/UpdateChecker';
import WebDeprecatedScreen from '@/components/WebDeprecatedScreen';
import { detectPlatform } from '@/lib/platform';
import { Toaster } from '@/components/ui/sonner';

function shouldShowWebDeprecated(): boolean {
  if (typeof window === 'undefined') return false;
  if (detectPlatform() !== 'web') return false;
  if (window.location.protocol !== 'https:') return false;
  const host = window.location.hostname;
  // Keep Lovable editor/preview usable
  if (host.endsWith('.lovableproject.com')) return false;
  if (host.endsWith('.lovableproject-dev.com')) return false;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return false;
  return true;
}

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
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pré-cache automatique des images visibles au chargement
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      const images = document.querySelectorAll('img[src]');
      const urls: string[] = [];
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('http') && !src.includes('youtube') && !src.includes('ytimg')) {
          urls.push(src);
        }
      });
      if (urls.length > 0) preloadImages(urls);
    }, 2000);
    return () => clearTimeout(timer);
  }, [loading, user]);

  useEffect(() => {
    if (!user || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, [user, loading]);

  // Heartbeat présence
  useEffect(() => {
    if (!user) return;
    pingPresence(user.id);
    const interval = setInterval(() => pingPresence(user.id), 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Notifications temps réel via PocketBase
  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('notifications').subscribe('*', (e) => {
          if (e.action !== 'create') return;
          const n: any = e.record;
          if (n.recipient_id !== user.id) return;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(n.title, { body: n.body ?? '' });
          }
          if (n.type === 'session_invite') {
            const code = n.data?.code;
            toast(n.title, {
              description: n.body,
              duration: 15000,
              action: code ? { label: 'Rejoindre', onClick: () => navigate(`/listen-together?code=${code}`) } : undefined,
            });
          } else {
            toast(n.title, { description: n.body ?? undefined });
          }
        });
      } catch (err) {
        console.error('notif subscribe', err);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  const profileCompleted = profile?.profile_completed ?? false;

  const pathToActive: Record<string, 'home' | 'profile'> = {
    '/jux': 'home',
    '/profile': 'profile',
    '/profile-edit': 'profile',
    '/upload': 'profile',
    '/profile/setup': 'profile',
    '/profile-setup': 'profile',
    '/wrapped': 'profile',
  };
  const active = pathToActive[location.pathname] || 'home';

  const guard = (el: JSX.Element) => profileCompleted ? <PageWrap>{el}</PageWrap> : <Navigate to="/profile-setup" replace />;

  return (
    <PlayerProvider>
      <div className="min-h-screen">
        {profileCompleted && <UpdateChecker />}
        <main>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/jux" replace />} />
              <Route path="/profile-setup" element={<PageWrap><ProfileSetup /></PageWrap>} />
              <Route path="/jux" element={guard(<Home />)} />
              <Route path="/home" element={<Navigate to="/jux" replace />} />
              <Route path="/upload" element={guard(<Upload />)} />
              <Route path="/u/:userId" element={guard(<UserProfile />)} />
              <Route path="/profile" element={guard(<ProfilePage />)} />
              <Route path="/profile-edit" element={guard(<ProfileEdit onBack={() => navigate('/profile')} />)} />
              <Route path="/profile/setup" element={<Navigate to="/profile-setup" replace />} />
              <Route path="*" element={<Navigate to="/jux" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
        <MiniPlayer />
        <PlayerPage />
        {profileCompleted && (
          <BottomNav
            active={active}
            onNavigate={(page) => {
              if (page === 'home') navigate('/jux');
              else navigate(`/${page}`);
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
