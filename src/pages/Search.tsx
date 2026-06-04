import { useState, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, Music2, Users } from 'lucide-react';
import type { Song } from '@/types/music';

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.title || '', author: r.author || '', audio: r.audio || '',
    cover: r.cover || null, audio_url: r.audio_url || '',
    cover_url: r.cover_url || null, video_url: r.video_url || null, genre: r.genre || null,
    uploaded_by: r.uploaded_by || '', duration: r.duration || 0, play_count: r.play_count ?? 0,
    weekly_play_count: r.weekly_play_count ?? 0, likes_count: r.likes_count ?? 0,
    created_at: r.created, updated_at: r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

export default function Search() {
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    if (!term.trim()) return;
    setSearched(true);
    const t = term.trim();
    try {
      const [songRes, userRes] = await Promise.all([
        pb.collection('songs').getList(1, 30, {
          filter: `title ~ "${t}" || author ~ "${t}" || genre ~ "${t}"`,
          requestKey: null,
        }),
        pb.collection('profiles').getList(1, 20, {
          filter: `pseudo ~ "${t}"`,
          requestKey: null,
        }),
      ]);
      setSongs(songRes.items.map(recordToSong));
      setUsers(userRes.items.map((r: any) => ({ id: r.id, user_id: r.get('user_id'), pseudo: r.get('pseudo'), avatar_url: r.get('avatar') ? URL.createObjectURL(new Blob()) : null })));
    } catch { setSongs([]); setUsers([]); }
  }, [term]);

  useEffect(() => {
    if (!term.trim()) { setSongs([]); setUsers([]); setSearched(false); }
  }, [term]);

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Recherche</h1>
      </header>
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Titre, artiste, genre, utilisateur..."
          value={term} onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          className="pl-9"
        />
      </div>
      {!searched && (
        <p className="text-center text-sm text-muted-foreground mt-8">Tape un mot-clé pour commencer la recherche</p>
      )}
      {songs.length > 0 && (
        <section className="mb-6">
          <h2 className="flex items-center gap-2 text-lg font-bold mb-3"><Music2 className="h-5 w-5" />Musiques</h2>
          <div className="grid grid-cols-2 gap-3">
            {songs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />))}
          </div>
        </section>
      )}
      {searched && songs.length === 0 && users.length === 0 && (
        <p className="text-center text-sm text-muted-foreground mt-8">Aucun résultat pour "{term}"</p>
      )}
    </div>
  );
}