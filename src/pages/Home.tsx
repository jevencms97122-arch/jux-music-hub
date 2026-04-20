import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import StoryCircles from '@/components/StoryCircles';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Bell, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Song } from '@/types/music';
import juxLogo from '@/assets/jux-logo.png';

export default function Home() {
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('songs').select('*').order('created_at', { ascending: false }).limit(50);
      setSongs((data ?? []) as Song[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const { count } = await supabase
        .from('notifications').select('*', { count: 'exact', head: true })
        .eq('recipient_id', authUser.id).eq('is_read', false);
      setUnread(count ?? 0);
    })();
  }, [authUser]);

  return (
    <div className="min-h-screen pb-40">
      <header className="flex items-center justify-between p-4">
        <img src={juxLogo} alt="Jux" className="h-8" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/search')}>
            <SearchIcon className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/favorites')}>
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
          </Button>
        </div>
      </header>

      <StoryCircles />

      <section className="px-4">
        <h2 className="mb-3 text-lg font-bold text-foreground">Découvre</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-secondary" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune musique pour l'instant. Sois le premier à uploader !
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s) => (
              <SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
