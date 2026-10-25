import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import SplashScreen from '@/components/SplashScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OfflineModeProvider, useOfflineMode } from '@/contexts/OfflineModeContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { isTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { playInterfaceSound } from '@/lib/interfaceSounds';
import { isLowPerf } from '@/lib/perfProfile';
import { startVisibilityPolling } from '@/lib/visibilityPolling';

// Lu une seule fois : le palier ne change pas en cours de session (cf. perfProfile).
const LOW_PERF = isLowPerf();

// Le module 'sonner' exporte un singleton `toast` — patcher ses méthodes ici
// suffit à jouer le SFX pour tous les toast.success/toast.error de l'app,
// sans devoir toucher chaque site d'appel.
const _toastSuccess = toast.success.bind(toast);
toast.success = ((...args: Parameters<typeof _toastSuccess>) => {
  playInterfaceSound('success');
  return _toastSuccess(...args);
}) as typeof toast.success;
const _toastError = toast.error.bind(toast);
toast.error = ((...args: Parameters<typeof _toastError>) => {
  playInterfaceSound('error');
  return _toastError(...args);
}) as typeof toast.error;
import { updatePresence, clearPresence } from '@/lib/userPresence';
import { sendSmartNotification } from '@/lib/smartNotifications';
import { precacheLibraryForOffline } from '@/lib/offlinePrecache';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';

// Pages chargées à la demande. Sans ce découpage, le bundle initial contenait
// les 24 pages de l'app : sur un appareil modeste, le simple parsing/compilation
// de ce JavaScript bloque le thread principal plusieurs secondes avant le
// premier affichage. Login et Home restent dans le bundle initial, ce sont les
// deux premiers écrans possibles — les charger en différé ajouterait un aller-
// retour réseau visible au démarrage.
const Upload = lazy(() => import('@/pages/Upload'));
const ProfileSetup = lazy(() => import('@/pages/ProfileSetup'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const ProfileEdit = lazy(() => import('@/pages/ProfileEdit'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const Playlists = lazy(() => import('@/pages/Playlists'));
const PlaylistDetail = lazy(() => import('@/pages/PlaylistDetail'));
const Social = lazy(() => import('@/pages/Social'));
const Chat = lazy(() => import('@/pages/Chat'));
const ListenTogether = lazy(() => import('@/pages/ListenTogether'));
const Search = lazy(() => import('@/pages/Search'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const Wrapped = lazy(() => import('@/pages/Wrapped'));
const CarMode = lazy(() => import('@/pages/CarMode'));
const Rank = lazy(() => import('@/pages/Rank'));
const SongPlayer = lazy(() => import('@/pages/SongPlayer'));
const CreateStory = lazy(() => import('@/pages/CreateStory'));
const OfflinePlaylists = lazy(() => import('@/pages/OfflinePlaylists'));
const OfflinePlaylistDetail = lazy(() => import('@/pages/OfflinePlaylistDetail'));

import Login from '@/pages/Login';
import Home from '@/pages/Home';
import MiniPlayer from '@/components/MiniPlayer';
import PlayerPage from '@/components/PlayerPage';
import BottomNav from '@/components/BottomNav';
import UpdateChecker from '@/components/UpdateChecker';
import TauriUpdateManager from '@/components/TauriUpdateManager';
import AndroidUpdateManager from '@/components/AndroidUpdateManager';
import UpdateAppliedNotice from '@/components/UpdateAppliedNotice';
import WebDeprecatedScreen from '@/components/WebDeprecatedScreen';
import GamepadController from '@/components/GamepadController';
import BannedScreen from '@/components/BannedScreen';
import RequiresBackend from '@/components/RequiresBackend';
import { isVRModeEnabled } from '@/hooks/useVRMode';
import { Toaster } from '@/components/ui/sonner';
import ChatNotifier from '@/components/ChatNotifier';
import AutoDownloadNotifier from '@/components/AutoDownloadNotifier';

function shouldShowWebDeprecated(): boolean {
  return false;
}

const pageVariants = {
  initial: { opacity: 0, y: 10, scale: 0.985 },
  in: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  out: { opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } },
};

// Sur un appareil modeste, la transition de page est le pire moment pour
// demander du travail supplémentaire : l'ancienne page et la nouvelle sont
// montées en même temps, et framer-motion animerait opacity + transform + scale
// sur tout l'arbre pendant que la nouvelle page lance ses requêtes et décode ses
// images. On rend alors la page directement.
const PageWrap = ({ children }: { children: React.ReactNode }) => {
  if (LOW_PERF) return <>{children}</>;
  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants}>
      {children}
    </motion.div>
  );
};

/** Affiché le temps que le code d'une page chargée à la demande arrive. */
const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

/**
 * Enveloppe des routes : Suspense pour le chargement différé du code de page, et
 * AnimatePresence uniquement là où une transition est effectivement jouée (son
 * mode "wait" retient le montage de la nouvelle page le temps que l'ancienne
 * finisse de sortir — un délai pur quand il n'y a rien à animer).
 *
 * Suspense reste à l'extérieur : AnimatePresence suit les clés de ses enfants
 * directs pour savoir qui sort, et un Suspense intercalé les lui masquerait.
 */
const RouteTransition = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageFallback />}>
    {LOW_PERF ? children : (
      <AnimatePresence mode="wait" initial={false}>
        {children}
      </AnimatePresence>
    )}
  </Suspense>
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
  const firstRun = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstRun.current) { firstRun.current = false; return; }
    playInterfaceSound('transition');
  }, [pathname]);
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
    return startVisibilityPolling(fetchUnread, 30000);
  }, [user]);


  useEffect(() => {
    if (!user || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, [user, loading]);

  // Pré-téléchargement hors connexion : quand on est en ligne, les favoris et
  // écoutes récentes descendent en local (IndexedDB) en tâche de fond, pour que
  // le mode hors connexion ait une vraie bibliothèque à offrir.
  useEffect(() => {
    if (!user || loading || offline) return;
    const t = setTimeout(() => { precacheLibraryForOffline(user.id).catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, [user, loading, offline]);


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
            sendSmartNotification('friend_request', {
              title: message,
              duration: 6000,
              action: { label: 'Voir', onClick: () => navigate('/notifications') },
            });
          } else if (n.type === 'session_invite') {
            const code = n.data?.code;
            sendSmartNotification('session_invite', {
              title: n.title,
              body: n.body,
              duration: 15000,
              action: code ? { label: 'Rejoindre', onClick: () => navigate(`/listen-together?code=${code}`) } : undefined,
            });
          } else if (n.type === 'friend_listening') {
            sendSmartNotification('friend_listening', {
              title: n.title,
              body: n.body ?? undefined,
              action: { label: 'Voir', onClick: () => navigate('/social') },
            });
          } else {
            sendSmartNotification('generic', { title: n.title, body: n.body ?? undefined });
          }
        });
      } catch (err) {
        console.error('notif subscribe', err);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [user, navigate]);

  // Messages privés temps réel → notification
  const pathRef = useRef(location.pathname);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);
  const shownMsgIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        unsub = await pb.collection('messages').subscribe('*', async (e) => {
          if (e.action !== 'create') return;
          const m: any = e.record;
          if (m.recipient_id !== user.id) return;
          if (shownMsgIds.current.has(m.id)) return;
          shownMsgIds.current.add(m.id);
          // Pas de notif si on est déjà dans cette conversation
          if (pathRef.current === `/chat/${m.sender_id}`) return;

          let pseudo = 'Nouveau message';
          try {
            const res = await pb.collection('profiles').getList(1, 1, { filter: `user_id = "${m.sender_id}"`, requestKey: null });
            if (res.items[0]?.pseudo) pseudo = res.items[0].pseudo as string;
          } catch {}

          const body = m.type === 'voice' ? '🎤 Message vocal'
            : m.type === 'song_share' ? '🎵 T\'a partagé une musique'
            : (m.text || 'Nouveau message');

          sendSmartNotification('new_message', {
            title: `Message de ${pseudo}`,
            body,
            duration: 8000,
            action: { label: 'Ouvrir', onClick: () => navigate(`/chat/${m.sender_id}`) },
          });
        });
      } catch (err) {
        console.error('messages subscribe', err);
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
    const active = pathToActive[location.pathname] || (location.pathname.startsWith('/playlist/') ? 'playlists' : (location.pathname.startsWith('/u/') || location.pathname.startsWith('/chat/')) ? 'social' : 'home');
    // La composition de story occupe tout l'écran : nav et mini lecteur masqueraient l'aperçu.
    const fullScreenPage = location.pathname === '/create-story';
    const hideBottomNav = location.pathname.startsWith('/chat/') || fullScreenPage;

    const guard = (el: JSX.Element) => profileCompleted ? <PageWrap>{el}</PageWrap> : <Navigate to="/profile-setup" replace />;
    const backendGuard = (el: JSX.Element) => offline ? <PageWrap><RequiresBackend /></PageWrap> : guard(el);

    mainContent = (
      <PlayerProvider>
        <ScrollToTop />
        <PresenceHeartbeat />
        <ChatNotifier />
        <AutoDownloadNotifier />
        <GamepadController />
        <div className="min-h-screen">
          {/* UpdateChecker = ancien système (versions codées en dur, Electron/Android) : désactivé sous Tauri desktop, remplacé par TauriUpdateManager */}
          {profileCompleted && !isTauri() && <UpdateChecker />}
          <TauriUpdateManager />
          <AndroidUpdateManager />
          <UpdateAppliedNotice />
          <main>
            <RouteTransition>
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Navigate to="/jux" replace />} />
                <Route path="/profile-setup" element={<PageWrap><ProfileSetup /></PageWrap>} />
                <Route path="/jux" element={guard(<Home />)} />
                <Route path="/home" element={<Navigate to="/jux" replace />} />
                <Route path="/upload" element={backendGuard(<Upload />)} />
                <Route path="/u/:userId" element={backendGuard(<UserProfile />)} />
                <Route path="/profile" element={guard(<ProfilePage />)} />
                <Route path="/profile-edit" element={guard(<ProfileEdit onBack={() => navigate('/profile')} />)} />
                <Route path="/profile/setup" element={<Navigate to="/profile-setup" replace />} />
                <Route path="/playlists" element={offline ? guard(<OfflinePlaylists />) : guard(<Playlists />)} />
                <Route path="/playlist/:id" element={offline ? guard(<OfflinePlaylistDetail />) : guard(<PlaylistDetail />)} />
                <Route path="/social" element={offline ? <Navigate to="/jux" replace /> : guard(<Social />)} />
                <Route path="/chat/:userId" element={offline ? <Navigate to="/jux" replace /> : guard(<Chat />)} />
                <Route path="/listen-together" element={offline ? <Navigate to="/jux" replace /> : guard(<ListenTogether />)} />
                <Route path="/search" element={backendGuard(<Search />)} />
                <Route path="/notifications" element={backendGuard(<Notifications />)} />
                <Route path="/favorites" element={backendGuard(<Favorites />)} />
                <Route path="/wrapped" element={backendGuard(<Wrapped />)} />
                <Route path="/car-mode" element={guard(<CarMode />)} />
                <Route path="/rank" element={backendGuard(<Rank />)} />
                <Route path="/song/:id" element={backendGuard(<SongPlayer />)} />
                <Route path="/create-story" element={backendGuard(<CreateStory />)} />
                <Route path="*" element={<Navigate to="/jux" replace />} />
              </Routes>
            </RouteTransition>
          </main>
          {!fullScreenPage && <MiniPlayer />}
          <PlayerPage />
          {profileCompleted && !hideBottomNav && (
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
  const location = useLocation();
  const isAnimated = currentTheme.backgroundAnimation != null;
  // Les fonds Ultra ne sont pas montés sur le palier bas (cf. ThemeContext) :
  // sans ça, le conteneur resterait transparent devant un fond absent.
  const isUltra = currentTheme.isUltra === true && !LOW_PERF;
  return (
    <div
      style={{
        background: isAnimated || isUltra ? 'transparent' : currentTheme.background,
        backgroundSize: isAnimated ? '200% 200%' : undefined,
        animation: isAnimated && !LOW_PERF ? currentTheme.backgroundAnimation : undefined,
        minHeight: '100vh',
      }}
      data-animated-bg={isAnimated ? '' : undefined}
    >
      {/* resetKey = pathname : un crash sur une page ne bloque que cette page,
          la navigation suivante réessaie automatiquement au lieu de rester noire. */}
      <ErrorBoundary resetKey={location.pathname}>
        <AppContent />
      </ErrorBoundary>
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
      <ErrorBoundary>
        <OfflineModeProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppWithTheme />
            </AuthProvider>
          </ThemeProvider>
        </OfflineModeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
