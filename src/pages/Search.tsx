import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import SongCard from '@/components/SongCard';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { avatarUrl } from '@/lib/storage';
import type { Song, Profile } from '@/types/music';
import { Search as SearchIcon } from 'lucide-react';
import { useSeo } from '@/lib/useSeo';

export default function Search() {
  useSeo({
    title: 'Recherche — Jux-Music',
    description: 'Recherche des titres, artistes et utilisateurs sur Jux-Music.',
    path: '/search',
  });
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setSongs([]); setUsers([]); return; }
      const [sRes, uRes] = await Promise.all([
        supabase.from('songs').select('*').or(`title.ilike.%${term}%,author.ilike.%${term}%,genre.ilike.%${term}%`).limit(30),
        supabase.from('profiles').select('*').ilike('pseudo', `%${term}%`).limit(20),
      ]);
      setSongs((sRes.data ?? []) as Song[]);
      setUsers((uRes.data ?? []) as Profile[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="min-h-screen px-4 py-6 pb-40">
      <div className="relative mb-4" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Rechercher titres, artistes, utilisateurs..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {users.length > 0 && (
        <section className="mb-6" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.1s' }}>
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">Utilisateurs</h2>
          <div className="space-y-2">
            {users.map((u, i) => (
              <button
                key={u.id}
                onClick={() => navigate(`/u/${u.user_id}`)}
                className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-secondary"
                style={{ animation: 'fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.15 + i * 0.04}s` }}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl(u)} />
                  <AvatarFallback>{u.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">{u.pseudo}</p>
                  {u.bio && <p className="truncate text-xs text-muted-foreground">{u.bio}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.2s' }}>
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">Morceaux</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {songs.map((s, i) => (
              <div key={s.id} style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.3 + i * 0.04}s` }}>
                <SongCard song={s} onPlay={() => playSongFromList(s, songs)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {q && songs.length === 0 && users.length === 0 && (
        <p className="text-center text-sm text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.15s' }}>
          Aucun résultat
        </p>
      )}
    </div>
  );
}