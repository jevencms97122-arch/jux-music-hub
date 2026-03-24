import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [newSongs, setNewSongs] = useState<Song[]>([]);
  const [relistenSongs, setRelistenSongs] = useState<Song[]>([]);
  const [discoverSongs, setDiscoverSongs] = useState<Song[]>([]);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [showAllNew, setShowAllNew] = useState(false);
  const [showAllRelisten, setShowAllRelisten] = useState(false);
  const [allNewSongs, setAllNewSongs] = useState<Song[]>([]);
  const [allRelistenSongs, setAllRelistenSongs] = useState<Song[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ignoreAbort = (error: any) => {
      if (error?.isAbort) return;
      console.error(error);
    };

    pb.collection('songs').getList(1, 10, { sort: '-created', expand: 'uploadedBy' })
      .then(r => setNewSongs(r.items as unknown as Song[]))
      .catch(ignoreAbort);

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
    }
  }, [user]);

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

  const handleShowAllNew = async () => {
    if (allNewSongs.length === 0) {
      const r = await pb.collection('songs').getFullList({ sort: '-created', expand: 'uploadedBy' });
      setAllNewSongs(r as unknown as Song[]);
    }
    setShowAllNew(true);
  };

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

  if (showAllNew) {
    return (
      <div className="pb-28 pt-4">
        <div className="flex items-center gap-3 px-4 mb-4">
          <button onClick={() => setShowAllNew(false)} className="text-sm text-primary" type="button">← Retour</button>
          <h1 className="text-xl font-bold text-foreground">Nouveautés</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-4">
          {allNewSongs.map(s => (
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
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 px-4 py-4">
        <img src={juxLogo} alt="Jux" className="h-8 w-auto" />
      </div>

      <SongRow title="Nouveautés" songs={newSongs} onSeeAll={handleShowAllNew} />
      <SongRow title="Réécouter" songs={relistenSongs} onSeeAll={relistenSongs.length > 0 ? handleShowAllRelisten : undefined} />

      <section className="px-4">
        <h2 className="text-lg font-bold text-foreground mb-3">Découvrir</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {discoverSongs.map((song, i) => (
            <SongCard
              key={`${song.id}-${i}`}
              song={song}
              size="sm"
              isActive={currentSong?.id === song.id}
              isPlaying={isPlaying}
              onPlay={playSong}
            />
          ))}
        </div>
        <div ref={sentinelRef} className="py-4 text-center">
          {loadingDiscover && <p className="text-sm text-muted-foreground">Chargement...</p>}
        </div>
      </section>
    </div>
  );
}
