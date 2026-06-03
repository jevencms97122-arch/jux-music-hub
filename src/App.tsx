import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Favorites from "./pages/Favorites";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import Notifications from "./pages/Notifications";
import Social from "./pages/Social";
import UserProfile from "./pages/UserProfile";
import ProfileEdit from "./pages/ProfileEdit";
import ProfileSetup from "./pages/ProfileSetup";
import Wrapped from "./pages/Wrapped";
import CarMode from "./pages/CarMode";
import ListenTogether from "./pages/ListenTogether";
import CollabDetail from "./pages/CollabDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PlayerProvider>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/search" element={<Search />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/social" element={<Social />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/profile/setup" element={<ProfileSetup />} />
              <Route path="/wrapped" element={<Wrapped />} />
              <Route path="/car-mode" element={<CarMode />} />
              <Route path="/listen-together" element={<ListenTogether />} />
              <Route path="/collab/:id" element={<CollabDetail />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </PlayerProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;