import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from '@/pages/Login';
import { Button } from '@/components/ui/button';

function HomeStub() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center gap-4">
      <h1 className="text-3xl font-bold">Bienvenue sur Jux 🎶</h1>
      <p className="text-muted-foreground max-w-md">
        Connecté en tant que <strong>{user?.email}</strong>.
      </p>
      <p className="text-sm text-muted-foreground max-w-md">
        Le backend Supabase est opérationnel. La migration des pages musicales
        (Home, Upload, Player, Playlists, Social, Stories, Notifications)
        se poursuit dans les prochains messages.
      </p>
      <Button variant="outline" onClick={logout}>Se déconnecter</Button>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to="/jux" replace />} />
      <Route path="/jux" element={<HomeStub />} />
      <Route path="*" element={<Navigate to="/jux" replace />} />
    </Routes>
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
