import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import type { Song } from '@/types/music';
import SongRow from '@/components/SongRow';
import SongCard from '@/components/SongCard';
import juxLogo from '@/assets/jux-logo.png';

export default function Home() {
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();

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

  // Section 4: Discover
  const [discoverSongs, setDiscoverSongs] = useState<Song[]>([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const ignoreAbort = (error: any) => {
    if (error?.isAbort) return;
    console.error(error);
  };

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

      {/* Section 1: Tag-based recommendations */}
      {tagSongs.length > 0 && (
        <SongRow title="Pour toi" songs={tagSongs} onSeeAll={handleShowAllTags} />
      )}

      {/* Section 2: Réécouter */}
      <SongRow title="Réécouter" songs={relistenSongs} onSeeAll={relistenSongs.length > 0 ? handleShowAllRelisten : undefined} />

      {/* Section 3: Nouveautés */}
      <SongRow title="Nouveautés" songs={newSongs} onSeeAll={handleShowAllNew} />

      {/* Section 4: Découvrir */}
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
    </div>
  );
}
