import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/lib/useSeo';
import SongCard from '@/components/SongCard';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import type { Song } from '@/types/music';

function getField(r: any, key: string): any {
  // PocketBase records often expose values via r.field
  if (r && typeof r.get === 'function') return r.get(key);
  return r?.[key];
}

function recordToSong(r: any): Song {
  const title = getField(r, 'title') ?? getField(r, 'song_title') ?? r?.title ?? '';
  const author = getField(r, 'author') ?? getField(r, 'song_author') ?? r?.author ?? '';

  return {
    id: getField(r, 'id') ?? r.id,
    title: String(title ?? ''),
    author: String(author ?? ''),
    audio: getField(r, 'audio') ?? '',
    cover: getField(r, 'cover') ?? null,
    audio_url: getField(r, 'audio_url') ?? '',
    cover_url: getField(r, 'cover_url') ?? null,
    video_url: getField(r, 'video_url') ?? null,
    genre: getField(r, 'genre') ?? null,
    uploaded_by: getField(r, 'uploaded_by') ?? '',
    duration: getField(r, 'duration') ?? 0,
    play_count: (getField(r, 'play_count') ?? 0) as number,
    weekly_play_count: (getField(r, 'weekly_play_count') ?? 0) as number,
    likes_count: (getField(r, 'likes_count') ?? 0) as number,
    created_at: getField(r, 'created') ?? getField(r, 'created_at') ?? r.created,
    updated_at: getField(r, 'updated') ?? getField(r, 'updated_at') ?? r.updated,
    collectionId: getField(r, 'collectionId') ?? r.collectionId,
    collectionName: getField(r, 'collectionName') ?? r.collectionName,
  };
}

export default function Favorites() {
  useSeo({ title: 'Favoris — Nexora Music', description: 'Tes musiques likées sur Nexora Music.', path: '/favorites' });
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const likes = await pb.collection('song_likes').getList(1, 200, { filter: `user_id = "${user.id}"`, sort: '-created', requestKey: null });
      const ids = likes.items.map((r: any) => r.song_id).filter(Boolean);
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