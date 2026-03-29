import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pb, getUserAvatarUrl, getSongCoverUrl } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song, PBUser, Playlist } from '@/types/music';
import SongRow from '@/components/SongRow';
import SongCard from '@/components/SongCard';
import juxLogo from '@/assets/jux-logo.png';
import { Search as SearchIcon, X, User } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();

  // Search state
  const [query, setQuery] = useState('');
  const [searchSongs, setSearchSongs] = useState<Song[]>([]);
  const [searchUsers, setSearchUsers] = useState<PBUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Section 1: Tag-based recommendations
  const [tagSongs, setTagSongs] = useState<Song[]>([]);
  const [allTagSongs, setAllTagSongs] = useState<Song[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);

  // Section 2: Relisten
  const [relistenSongs, setRelistenSongs] = useState<Song[]>([]);
  const [allRelistenSongs, setAllRelistenSongs] = useState<Song[]>([]);
  const [showAllRelisten, setShowAllRelisten] = useState(false);

  // Section 3: Nouveautés with pagination
  const [newSongs, setNewSongs] = useState<Song[]>([]);
  const [allNewSongs, setAllNewSongs] = useState<Song[]>([]);
  const [showAllNew, setShowAllNew] = useState(false);
  const [newPage, setNewPage] = useState(1);
  const [hasMoreNew, setHasMoreNew] = useState(true);
  const [loadingNew, setLoadingNew] = useState(false);
  const newSentinelRef = useRef<HTMLDivElement>(null);

  // Section 4: Community playlists
  const [communityPlaylists, setCommunityPlaylists] = useState<Playlist[]>([]);
  const [playlistSongsMap, setPlaylistSongsMap] = useState<Record<string, Song[]>>({});

  // Section 5: Discover
  const [discoverSongs, setDiscoverSongs] = useState<Song[]>([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const ignoreAbort = (error: any) => {
    if (error?.isAbort) return;
    console.error(error);
  };

  // Search function
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchSongs([]);
      setSearchUsers([]);
      return;
    }
    setSearchLoading(true);
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
      setSearchSongs(songsRes.items as unknown as Song[]);
      setSearchUsers(usersRes.items as unknown as PBUser[]);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Helper function to parse thumbnailOrder (stores image URLs)
  const parseThumbnailOrder = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Helper function to get thumbnail URL for display (single mode only)
  const getThumbnailUrl = (songs: Song[], playlist: Playlist): string | null => {
    if (!songs || songs.length === 0) return null;
    
    const urls = parseThumbnailOrder(playlist.thumbnailOrder);
    
    // If we have stored URL, use it
    if (urls && urls.length > 0) {
      return urls[0];
    }
    
    // Fallback: generate URL from first song
    return getSongCoverUrl(songs[0]);
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Load initial data
  useEffect(() => {
    // New songs (row preview)
    pb.collection('songs').getList(1, 10, { sort: '-created', expand: 'uploadedBy' })
      .then(r => setNewSongs(r.items as unknown as Song[]))
      .catch(ignoreAbort);

    // Relisten
    if (user) {
      pb.collection('listen_history').getList(1, 10, {
        filter: `user="${user.id}"`,
        sort: '-listenedAt',
        expand: 'song,song.uploadedBy',
      }).then(r => {
        const songs: Song[] = [];
        const seen = new Set<string>();
        for (const item of r.items) {
          const s = (item as any).expand?.song;
          if (s && !seen.has(s.id)) { seen.add(s.id); songs.push(s); }
        }
        setRelistenSongs(songs);
      }).catch(ignoreAbort);

      // Tag-based recommendations: get genres from liked songs
      pb.collection('song_likes').getFullList({
        filter: `user="${user.id}"`,
        expand: 'song',
      }).then(async (likes) => {
        const genres = new Set<string>();
        for (const like of likes) {
          const song = (like as any).expand?.song;
          if (song?.genre) genres.add(song.genre);
        }
        if (genres.size === 0) return;

        const genreFilter = Array.from(genres).map(g => `genre="${g}"`).join('||');
        // Exclude already liked songs
        const likedIds = likes.map((l: any) => l.song).filter(Boolean);
        const excludeFilter = likedIds.length > 0 
          ? likedIds.map((id: string) => `id!="${id}"`).join('&&')
          : '';
        const filter = excludeFilter ? `(${genreFilter})&&${excludeFilter}` : `(${genreFilter})`;

        try {
          const r = await pb.collection('songs').getList(1, 10, {
            filter,
            sort: '@random',
            expand: 'uploadedBy',
          });
          setTagSongs(r.items as unknown as Song[]);
        } catch (e) {
          ignoreAbort(e);
        }
      }).catch(ignoreAbort);

      // Load community playlists
      pb.collection('playlists').getList(1, 10, {
        filter: 'public = true && title != "Titres likés"',
        sort: '-likesCount',
        expand: 'owner',
      }).then(async (r) => {
        const playlists = r.items as unknown as Playlist[];
        setCommunityPlaylists(playlists);
        
        // Load songs for each playlist to get thumbnails
        const songsMap: Record<string, Song[]> = {};
        for (const playlist of playlists) {
          if (playlist.songs && playlist.songs.length > 0) {
            try {
              const songsData = await pb.collection('songs').getFullList({
                filter: playlist.songs.map((id: string) => `id="${id}"`).join('||'),
              });
              // Sort songs to match the order of IDs in playlist.songs
              const sortedSongs = playlist.songs.map((id: string) => 
                songsData.find((s: any) => s.id === id)
              ).filter(Boolean);
              songsMap[playlist.id] = sortedSongs as unknown as Song[];
            } catch (e) {
              console.error('Error loading playlist songs:', e);
            }
          }
        }
        setPlaylistSongsMap(songsMap);
      }).catch(ignoreAbort);
    }
  }, [user]);

  // Discover infinite scroll
  const loadDiscover = useCallback(async () => {
    if (loadingDiscover || !hasMore) return;
    setLoadingDiscover(true);
    try {
      const r = await pb.collection('songs').getList(discoverPage, 10, { sort: '@random', expand: 'uploadedBy' });
      if (r.items.length === 0) setHasMore(false);
      else {
        setDiscoverSongs(prev => [...prev, ...(r.items as unknown as Song[])]);
        setDiscoverPage(p => p + 1);
      }
    } catch (e: any) {
      if (!e?.isAbort) console.error(e);
    } finally {
      setLoadingDiscover(false);
    }
  }, [discoverPage, loadingDiscover, hasMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadDiscover();
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadDiscover]);

  // "See all" handlers
  const handleShowAllTags = async () => {
    if (allTagSongs.length === 0 && user) {
      const likes = await pb.collection('song_likes').getFullList({
        filter: `user="${user.id}"`, expand: 'song',
      });
      const genres = new Set<string>();
      for (const like of likes) {
        const song = (like as any).expand?.song;
        if (song?.genre) genres.add(song.genre);
      }
      if (genres.size > 0) {
        const genreFilter = Array.from(genres).map(g => `genre="${g}"`).join('||');
        const r = await pb.collection('songs').getFullList({ filter: `(${genreFilter})`, sort: '@random', expand: 'uploadedBy' });
        setAllTagSongs(r as unknown as Song[]);
      }
    }
    setShowAllTags(true);
  };

  const handleShowAllNew = async () => {
    setShowAllNew(true);
    setAllNewSongs([]);
    setNewPage(1);
    setHasMoreNew(true);
  };

  // Load paginated new songs in "see all" mode
  const loadMoreNew = useCallback(async () => {
    if (loadingNew || !hasMoreNew) return;
    setLoadingNew(true);
    try {
      const r = await pb.collection('songs').getList(newPage, 20, { sort: '-created', expand: 'uploadedBy' });
      if (r.items.length === 0) setHasMoreNew(false);
      else {
        setAllNewSongs(prev => [...prev, ...(r.items as unknown as Song[])]);
        setNewPage(p => p + 1);
      }
    } catch (e: any) {
      if (!e?.isAbort) console.error(e);
    } finally {
      setLoadingNew(false);
    }
  }, [newPage, loadingNew, hasMoreNew]);

  useEffect(() => {
    if (!showAllNew) return;
    const sentinel = newSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadMoreNew();
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showAllNew, loadMoreNew]);

  // Trigger initial load when entering "see all" mode
  useEffect(() => {
    if (showAllNew && allNewSongs.length === 0) loadMoreNew();
  }, [showAllNew]);

  const handleShowAllRelisten = async () => {
    if (user && allRelistenSongs.length === 0) {
      const r = await pb.collection('listen_history').getFullList({
        filter: `user="${user.id}"`, sort: '-listenedAt', expand: 'song,song.uploadedBy',
      });
      const songs: Song[] = [];
      const seen = new Set<string>();
      for (const item of r) {
        const s = (item as any).expand?.song;
        if (s && !seen.has(s.id)) { seen.add(s.id); songs.push(s); }
      }
      setAllRelistenSongs(songs);
    }
    setShowAllRelisten(true);
  };

  // "See all" full views
  if (showAllTags) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center gap-3 px-4 mb-4">
          <button onClick={() => setShowAllTags(false)} className="text-sm text-primary" type="button">← Retour</button>
          <h1 className="text-xl font-bold text-foreground">Pour toi</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4">
          {allTagSongs.map(s => (
            <SongCard key={s.id} song={s} size="sm" isActive={currentSong?.id === s.id} isPlaying={isPlaying} onPlay={playSong} />
          ))}
        </div>
      </div>
    );
  }

  if (showAllNew) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center gap-3 px-4 mb-4">
          <button onClick={() => setShowAllNew(false)} className="text-sm text-primary" type="button">← Retour</button>
          <h1 className="text-xl font-bold text-foreground">Nouveautés</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4">
          {allNewSongs.map(s => (
            <SongCard key={s.id} song={s} size="sm" isActive={currentSong?.id === s.id} isPlaying={isPlaying} onPlay={playSong} />
          ))}
        </div>
        <div ref={newSentinelRef} className="py-4 text-center">
          {loadingNew && <p className="text-sm text-muted-foreground">Chargement...</p>}
        </div>
      </div>
    );
  }

  if (showAllRelisten) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center gap-3 px-4 mb-4">
          <button onClick={() => setShowAllRelisten(false)} className="text-sm text-primary" type="button">← Retour</button>
          <h1 className="text-xl font-bold text-foreground">Réécouter</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4">
          {allRelistenSongs.map(s => (
            <SongCard key={s.id} song={s} size="sm" isActive={currentSong?.id === s.id} isPlaying={isPlaying} onPlay={playSong} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 px-4 py-4">
        <img src={juxLogo} alt="Jux" className="h-8 w-auto" />
      </div>

      {/* Search bar */}
      <div className="px-4 mb-6">
        <div className="relative">
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
      </div>

      {/* Search results */}
      {query && (
        <div className="px-4 mb-6">
          {searchLoading && <p className="text-sm text-muted-foreground text-center">Recherche...</p>}
          
          {!searchLoading && searchSongs.length === 0 && searchUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-8">Aucun résultat pour "{query}"</p>
          )}

          {searchUsers.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Utilisateurs</h2>
              <div className="space-y-2">
                {searchUsers.map(u => (
                  <div key={u.id} onClick={() => navigate(`/profile/${u.id}`)} className="flex items-center gap-3 p-2 rounded-lg bg-card cursor-pointer hover:bg-secondary transition-colors">
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

          {searchSongs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Musiques</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {searchSongs.map(s => (
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
        </div>
      )}

      {/* Normal content when not searching */}
      {!query && (
        <>
          {/* Section 1: Tag-based recommendations */}
          {tagSongs.length > 0 && (
            <SongRow title="Pour toi" songs={tagSongs} onSeeAll={handleShowAllTags} />
          )}

          {/* Section 2: Réécouter */}
          <SongRow title="Réécouter" songs={relistenSongs} onSeeAll={relistenSongs.length > 0 ? handleShowAllRelisten : undefined} />

          {/* Section 3: Nouveautés */}
          <SongRow title="Nouveautés" songs={newSongs} onSeeAll={handleShowAllNew} />

          {/* Section 4: Community playlists */}
          {communityPlaylists.length > 0 && (
            <section className="px-4 mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">Playlists de la communauté</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {communityPlaylists.map((playlist, i) => {
                  const thumbUrl = playlistSongsMap[playlist.id] 
                    ? getThumbnailUrl(playlistSongsMap[playlist.id], playlist)
                    : null;
                  
                  return (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      onClick={() => navigate(`/playlist/${playlist.id}`)}
                      className="flex-shrink-0 w-40 cursor-pointer group"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={playlist.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                            <svg className="w-12 h-12 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                              <svg className="h-5 w-5 text-primary-foreground ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground text-sm truncate">{playlist.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {playlist.expand?.owner?.pseudo || 'Utilisateur'}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 5: Découvrir */}
          <section className="px-4 mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Découvrir</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {discoverSongs.map((song, i) => (
                <motion.div
                  key={`${song.id}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  viewport={{ once: true }}
                  className="group transition-transform duration-300 hover:scale-105"
                >
                  <SongCard
                    song={song}
                    size="md"
                    isActive={currentSong?.id === song.id}
                    isPlaying={isPlaying}
                    onPlay={playSong}
                  />
                </motion.div>
              ))}
            </div>
            <div ref={sentinelRef} className="py-8 text-center">
              {loadingDiscover && (
                <div className="flex justify-center items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>Chargement...</span>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
