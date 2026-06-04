import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { songCoverUrl } from '@/lib/storage';
import SongCard from '@/components/SongCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Heart, Trash2, ListMusic, Plus, Users, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Song, Playlist, Profile } from '@/types/music';

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

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { playSongFromList } = usePlayer();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [liked, setLiked] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const pbGetFirst = async (collection: string, filter: string) => {
    try { const r = await pb.collection(collection).getList(1, 1, { filter, requestKey: null }); return r.items[0] || null; } catch { return null; }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await pb.collection('playlists').getOne(id);
        setPlaylist({ id: p.id, title: p.get('title'), description: p.get('description'), is_public: p.get('is_public'), owner_id: p.get('owner_id'), view_count: p.get('view_count'), play_count: p.get('play_count'), likes_count: p.get('likes_count'), thumbnail_mode: p.get('thumbnail_mode'), created_at: p.get('created') || p.created, updated_at: p.get('updated') || p.updated } as Playlist);
        
        const ps = await pb.collection('playlist_songs').getList(1, 100, { filter: `playlist_id = "${id}"`, sort: 'position', requestKey: null });
        const ids = ps.items.map((r: any) => r.get('song_id')).filter(Boolean);
        
        const songsList: Song[] = [];
        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50);
          const filters = batch.map((sId: string) => `id = "${sId}"`).join(' || ');
          const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
          songsList.push(...res.items.map(recordToSong));
        }
        setSongs(songsList);
        
        if (user) {
          const likeRecord = await pbGetFirst('playlist_likes', `playlist_id = "${id}" && user_id = "${user.id}"`);
          setLiked(!!likeRecord);
        }
        
        const collabs = await pb.collection('playlist_collaborators').getList(1, 50, { filter: `playlist_id = "${id}"`, requestKey: null });
        const userIds = collabs.items.map((r: any) => r.get('user_id')).filter(Boolean);
        if (userIds.length > 0) {
          const profFilters = userIds.map((uid: string) => `user_id = "${uid}"`).join(' || ');
          const profs = await pb.collection('profiles').getList(1, 50, { filter: profFilters, requestKey: null });
          setCollaborators(profs.items.map((r: any) => ({ id: r.get('user_id'), pseudo: r.get('pseudo'), avatar_url: r.get('avatar') })));
        }
      } catch { navigate('/playlists'); }
      setLoading(false);
    })();
  }, [id, user]);

  if (loading) return <div className="p-4">Chargement...</div>;
  if (!playlist) return null;

  const removeSong = async (songId: string) => {
    try {
      const records = await pb.collection('playlist_songs').getList(1, 1, { filter: `playlist_id = "${id}" && song_id = "${songId}"`, requestKey: null });
      if (records.items[0]) await pb.collection('playlist_songs').delete(records.items[0].id);
      setSongs((s) => s.filter((s) => s.id !== songId));
      toast.success('Retiré de la playlist');
    } catch {}
  };

  const toggleLike = async () => {
    if (!user || !id) return;
    try {
      if (liked) {
        const likeRecord = await pbGetFirst('playlist_likes', `playlist_id = "${id}" && user_id = "${user.id}"`);
        if (likeRecord) await pb.collection('playlist_likes').delete(likeRecord.id);
        setLiked(false);
      } else {
        await pb.collection('playlist_likes').create({ playlist_id: id, user_id: user.id });
        setLiked(true);
      }
    } catch {}
  };

  const deletePlaylist = async () => {
    if (!id) return;
    try { await pb.collection('playlists').delete(id); navigate('/playlists'); } catch {}
  };

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold truncate flex-1">{playlist.title}</h1>
        <Button variant="ghost" size="icon" onClick={toggleLike}><Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} /></Button>
        {user?.id === playlist.owner_id && <Button variant="ghost" size="icon" onClick={deletePlaylist}><Trash2 className="h-5 w-5 text-destructive" /></Button>}
      </header>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-primary"><ListMusic className="h-10 w-10 text-primary-foreground" /></div>
        <div>
          <p className="text-lg font-bold">{playlist.title}</p>
          {playlist.description && <p className="text-sm text-muted-foreground">{playlist.description}</p>}
          <p className="text-xs text-muted-foreground">{songs.length} titres · {playlist.likes_count} likes</p>
        </div>
      </div>

      {songs.length > 0 && (
        <Button className="w-full mb-4" onClick={() => playSongFromList(songs[0], songs)}>
          <Play className="h-4 w-4 mr-2" /> Lecture aléatoire
        </Button>
      )}

      {collaborators.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Users className="h-4 w-4" />Collaborateurs</p>
          <div className="flex gap-2 flex-wrap">
            {collaborators.map((c: any) => (<span key={c.id} className="text-xs bg-secondary rounded-full px-2 py-1">{c.pseudo || 'Anonyme'}</span>))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {songs.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <button onClick={() => playSongFromList(s, songs)} className="flex-1 flex items-center gap-3 rounded-xl bg-card/50 p-2 text-left hover:bg-card">
              <img src={songCoverUrl(s)} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.author}</p>
              </div>
            </button>
            {user?.id === playlist.owner_id && (
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeSong(s.id)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}