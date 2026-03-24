import { useState, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { getUserAvatarUrl } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song, PBUser } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Search as SearchIcon, X, User } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<PBUser[]>([]);
  const [loading, setLoading] = useState(false);
  const { playSong, currentSong, isPlaying } = usePlayer();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSongs([]);
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const [songsRes, usersRes] = await Promise.all([
        pb.collection('songs').getList(1, 20, {
          filter: `title~"${q}" || author~"${q}"`,
          expand: 'uploadedBy',
        }),
        pb.collection('users').getList(1, 10, {
          filter: `pseudo~"${q}" || firstName~"${q}" || lastName~"${q}"`,
        }),
      ]);
      setSongs(songsRes.items as unknown as Song[]);
      setUsers(usersRes.items as unknown as PBUser[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="pb-28 pt-4 px-4">
      <h1 className="text-xl font-bold text-foreground mb-4">Rechercher</h1>

      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Musique, artiste, utilisateur..."
          className="w-full h-10 pl-10 pr-10 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" type="button">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center">Recherche...</p>}

      {!query && !loading && (
        <p className="text-sm text-muted-foreground text-center mt-12">
          Tape quelque chose pour rechercher
        </p>
      )}

      {users.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Utilisateurs</h2>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-card">
                {u.avatar ? (
                  <img src={getUserAvatarUrl(u as any)} alt={u.pseudo} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{u.pseudo}</p>
                  <p className="text-xs text-muted-foreground">{u.firstName} {u.lastName}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {songs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Musiques</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {songs.map(s => (
              <SongCard
                key={s.id}
                song={s}
                size="sm"
                isActive={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={playSong}
              />
            ))}
          </div>
        </section>
      )}

      {query && !loading && songs.length === 0 && users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center mt-8">Aucun résultat pour "{query}"</p>
      )}
    </div>
  );
}
