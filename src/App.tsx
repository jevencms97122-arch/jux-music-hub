import { useEffect, useRef, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OfflineModeProvider, useOfflineMode } from '@/contexts/OfflineModeContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { toast } from 'sonner';
import { updatePresence, clearPresence } from '@/lib/userPresence';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import ProfileSetup from '@/pages/ProfileSetup';
import ProfilePage from '@/pages/ProfilePage';
import ProfileEdit from '@/pages/ProfileEdit';
import UserProfile from '@/pages/UserProfile';
import Playlists from '@/pages/Playlists';
import PlaylistDetail from '@/pages/PlaylistDetail';
import Social from '@/pages/Social';
import ListenTogether from '@/pages/ListenTogether';
import Search from '@/pages/Search';
import Notifications from '@/pages/Notifications';
import Favorites from '@/pages/Favorites';
import Wrapped from '@/pages/Wrapped';
import CarMode from '@/pages/CarMode';
import Rank from '@/pages/Rank';
import SongPlayer from '@/pages/SongPlayer';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import UpdateChecker from '@/components/UpdateChecker';
import WebAppUpdateNotifier from '@/components/WebAppUpdateNotifier';
import WebDeprecatedScreen from '@/components/WebDeprecatedScreen';
import GamepadController from '@/components/GamepadController';
import JuxAssistant from '@/components/JuxAssistant';
import BannedScreen from '@/components/BannedScreen';
import RequiresBackend from '@/components/RequiresBackend';
import OfflinePlaylists from '@/pages/OfflinePlaylists';
import OfflinePlaylistDetail from '@/pages/OfflinePlaylistDetail';
import { detectPlatform } from '@/lib/platform';
import { isVRModeEnabled } from '@/hooks/useVRMode';
import { Toaster } from '@/components/ui/sonner';

function shouldShowWebDeprecated(): boolean {
  if (typeof window === 'undefined') return false;
  if (detectPlatform() !== 'web') return false;
  return window.location.protocol === 'https:';
}

const pageVariants = {
  initial: { opacity: 0, y: 10, scale: 0.985 },
  in: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  out: { opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } },
};

const PageWrap = ({ children }: { children: React.ReactNode }) => (
  <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
    {children}
  </motion.div>
);

function PresenceHeartbeat() {
  const { user } = useAuth();
  const { currentSong, isPlaying } = usePlayer();
  const isPlayingRef = useRef(isPlaying);
  const currentSongRef = useRef(currentSong);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

  useEffect(() => {
    if (!user) return;
    const emit = () => {
      const cs = currentSongRef.current;
      updatePresence({
        userId: user.id,
        isListening: isPlayingRef.current,
        songId: cs?.id,
        songTitle: cs?.title,
        songAuthor: cs?.author,
        songCoverUrl: cs ? songCoverUrl(cs) : undefined,
      });
    };
    emit();
    const interval = setInterval(emit, 4000);
    const handleUnload = () => clearPresence(user.id);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      clearPresence(user.id);
    };
  }, [user]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppContent() {
  const { user, profile, loading, logout } = useAuth();
  const { offline } = useOfflineMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await pb.collection('notifications').getList(1, 1, {
          filter: `recipient_id = "${user.id}" && is_read = false`,
          requestKey: null,
        });
        setUnreadCount(res.totalItems);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);


  useEffect(() => {
    if (!user || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, [user, loading]);


  // Notifications temps réel via PocketBase
  const shownNotifIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('notifications').subscribe('*', (e) => {
          if (e.action !== 'create') return;
          const n: any = e.record;
          if (n.recipient_id !== user.id) return;
          // Dedup — PocketBase can fire the same event twice
          if (shownNotifIds.current.has(n.id)) return;
          shownNotifIds.current.add(n.id);

          if (n.type === 'friend_request') {
            const pseudo = n.data?.sender_pseudo || null;
            const message = pseudo ? `${pseudo} a commencé à vous suivre` : 'Quelqu\'un a commencé à vous suivre';
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(message);
            }
            toast(message, {
              duration: 6000,
              action: { label: 'Voir', onClick: () => navigate('/notifications') },
            });
          } else if (n.type === 'session_invite') {
            const code = n.data?.code;
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(n.title, { body: n.body ?? '' });
            }
            toast(n.title, {
              description: n.body,
              duration: 15000,
              action: code ? { label: 'Rejoindre', onClick: () => navigate(`/listen-together?code=${code}`) } : undefined,
            });
          } else {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(n.title, { body: n.body ?? '' });
            }
            toast(n.title, { description: n.body ?? undefined });
          }
        });
      } catch (err) {
        console.error('notif subscribe', err);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [user, navigate]);

  let mainContent: React.ReactNode;

  if (!offline && loading) {
    mainContent = (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  } else if (!offline && !user) {
    mainContent = <Login />;
  } else if (!offline && profile?.ban_status) {
    mainContent = <BannedScreen onLogout={logout} />;
  } else {
    const profileCompleted = offline ? true : (profile?.profile_completed ?? false);

    const pathToActive: Record<string, 'home' | 'search' | 'social' | 'playlists' | 'profile'> = {
      '/jux': 'home',
      '/profile': 'profile',
      '/profile-edit': 'profile',
      '/upload': 'profile',
      '/profile/setup': 'profile',
      '/profile-setup': 'profile',
      '/wrapped': 'profile',
      '/favorites': 'profile',
      '/search': 'search',
      '/social': 'social',
      '/listen-together': 'social',
      '/notifications': 'home',
      '/playlists': 'playlists',
    };
    const active = pathToActive[location.pathname] || (location.pathname.startsWith('/playlist/') ? 'playlists' : location.pathname.startsWith('/u/') ? 'social' : 'home');

    const guard = (el: JSX.Element) => profileCompleted ? <PageWrap>{el}</PageWrap> : <Navigate to="/profile-setup" replace />;
    const backendGuard = (el: JSX.Element) => offline ? <PageWrap><RequiresBackend /></PageWrap> : guard(el);

    mainContent = (
      <PlayerProvider>
        <ScrollToTop />
        <PresenceHeartbeat />
        <GamepadController />
        <JuxAssistant />
        <div className="min-h-screen">
          {profileCompleted && <UpdateChecker />}
          {profileCompleted && <WebAppUpdateNotifier />}
          <main>
            <AnimatePresence mode="wait" initial={false}>
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Navigate to="/jux" replace />} />
                <Route path="/profile-setup" element={<PageWrap><ProfileSetup /></PageWrap>} />
                <Route path="/jux" element={guard(<Home />)} />
                <Route path="/home" element={<Navigate to="/jux" replace />} />
                <Route path="/upload" element={guard(<Upload />)} />
                <Route path="/u/:userId" element={backendGuard(<UserProfile />)} />
                <Route path="/profile" element={guard(<ProfilePage />)} />
                <Route path="/profile-edit" element={guard(<ProfileEdit onBack={() => navigate('/profile')} />)} />
                <Route path="/profile/setup" element={<Navigate to="/profile-setup" replace />} />
                <Route path="/playlists" element={offline ? guard(<OfflinePlaylists />) : guard(<Playlists />)} />
                <Route path="/playlist/:id" element={offline ? guard(<OfflinePlaylistDetail />) : guard(<PlaylistDetail />)} />
                <Route path="/social" element={offline ? <Navigate to="/jux" replace /> : guard(<Social />)} />
                <Route path="/listen-together" element={offline ? <Navigate to="/jux" replace /> : guard(<ListenTogether />)} />
                <Route path="/search" element={backendGuard(<Search />)} />
                <Route path="/notifications" element={backendGuard(<Notifications />)} />
                <Route path="/favorites" element={backendGuard(<Favorites />)} />
                <Route path="/wrapped" element={backendGuard(<Wrapped />)} />
                <Route path="/car-mode" element={guard(<CarMode />)} />
                <Route path="/rank" element={backendGuard(<Rank />)} />
                <Route path="/song/:id" element={backendGuard(<SongPlayer />)} />
                <Route path="*" element={<Navigate to="/jux" replace />} />
              </Routes>
            </AnimatePresence>
          </main>
          <MiniPlayer />
          <PlayerPage />
          {profileCompleted && (
            <BottomNav
              active={active}
              hideSocial={offline}
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

  return (
    <>
      {!splashDismissed && (
        <SplashScreen
          onComplete={() => setSplashDone(true)}
          onDismiss={() => setSplashDismissed(true)}
        />
      )}
      <div
        style={{
          opacity: splashDone ? 1 : 0,
          pointerEvents: splashDone ? undefined : 'none',
          transition: splashDone ? 'opacity 0.6s ease' : undefined,
        }}
        aria-hidden={!splashDone || undefined}
      >
        {mainContent}
      </div>
    </>
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
  useEffect(() => {
    document.documentElement.toggleAttribute('data-vr-mode', isVRModeEnabled());
  }, []);

  if (shouldShowWebDeprecated()) {
    return <WebDeprecatedScreen />;
  }
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <OfflineModeProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppWithTheme />
          </AuthProvider>
        </ThemeProvider>
      </OfflineModeProvider>
    </BrowserRouter>
  );
}
