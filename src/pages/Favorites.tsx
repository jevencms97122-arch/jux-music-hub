import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import SongCard from '@/components/SongCard';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import type { Song } from '@/types/music';

function recordToSong(r: any): Song {
  return {
    id: r.id, title: r.get('title') || '', author: r.get('author') || '', audio_url: r.get('audio_url') || '',
    cover_url: r.get('cover_url') || null, video_url: r.get('video_url') || null, genre: r.get('genre') || null,
    uploaded_by: r.get('uploaded_by') || '', duration: r.get('duration') || 0, play_count: r.get('play_count') ?? 0,
    weekly_play_count: r.get('weekly_play_count') ?? 0, likes_count: r.get('likes_count') ?? 0,
    created_at: r.get('created') || r.created, updated_at: r.get('updated') || r.updated,
    collectionId: r.collectionId, collectionName: r.collectionName,
  };
}

export default function Favorites() {
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const likes = await pb.collection('song_likes').getList(1, 200, { filter: `user_id = "${user.id}"`, sort: '-created', requestKey: null });
      const ids = likes.items.map((r: any) => r.get('song_id')).filter(Boolean);
      if (ids.length === 0) { setSongs([]); return; }
      const songsList: Song[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const filters = batch.map((id: string) => `id = "${id}"`).join(' || ');
        const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
        songsList.push(...res.items.map(recordToSong));
      }
      setSongs(songsList);
    })();
  }, [user]);

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Mes favoris</h1>
      </header>
      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 text-muted-foreground">
          <Heart className="h-12 w-12 mb-4" />
          <p>Aucun favori pour l'instant</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {songs.map((s) => (<SongCard key={s.id} song={s} onPlay={() => playSongFromList(s, songs)} />))}
        </div>
      )}
    </div>
  );
}