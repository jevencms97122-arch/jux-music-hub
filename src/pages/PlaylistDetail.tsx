import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Trash2, Heart, ListMusic } from 'lucide-react';
import { songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Playlist, Song } from '@/types/music';

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [liked, setLiked] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: p } = await supabase.from('playlists').select('*').eq('id', id).maybeSingle();
    setPlaylist(p as Playlist | null);

    const { data: ps } = await supabase
      .from('playlist_songs').select('song_id, position').eq('playlist_id', id).order('position');
    const ids = (ps ?? []).map((x) => x.song_id);
    if (ids.length) {
      const { data: songsData } = await supabase.from('songs').select('*').in('id', ids);
      const ordered = ids.map((sid) => (songsData ?? []).find((s) => s.id === sid)).filter(Boolean) as Song[];
      setSongs(ordered);
    } else setSongs([]);

    if (authUser) {
      const { data: like } = await supabase
        .from('playlist_likes').select('id').eq('playlist_id', id).eq('user_id', authUser.id).maybeSingle();
      setLiked(!!like);
    }
  };

  useEffect(() => { load(); }, [id, authUser]);

  const isOwner = authUser && playlist?.owner_id === authUser.id;

  const removeSong = async (songId: string) => {
    if (!id) return;
    await supabase.from('playlist_songs').delete().eq('playlist_id', id).eq('song_id', songId);
    setSongs((s) => s.filter((x) => x.id !== songId));
  };

  const toggleLike = async () => {
    if (!authUser || !id) return;
    if (liked) {
      await supabase.from('playlist_likes').delete().eq('playlist_id', id).eq('user_id', authUser.id);
      setLiked(false);
    } else {
      await supabase.from('playlist_likes').insert({ playlist_id: id, user_id: authUser.id });
      setLiked(true);
    }
  };

  const deletePlaylist = async () => {
    if (!id || !confirm('Supprimer cette playlist ?')) return;
    await supabase.from('playlists').delete().eq('id', id);
    toast.success('Playlist supprimée');
    navigate('/playlists');
  };

  if (!playlist) return <div className="p-6 text-sm text-muted-foreground">Chargement...</div>;

  return (
    <div className="min-h-screen pb-40">
      <header className="flex items-center gap-2 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 truncate font-bold">{playlist.title}</h1>
        {!isOwner && (
          <Button variant="ghost" size="icon" onClick={toggleLike}>
            <Heart className={`h-5 w-5 ${liked ? 'fill-primary text-primary' : ''}`} />
          </Button>
        )}
        {isOwner && (
          <Button variant="ghost" size="icon" onClick={deletePlaylist}>
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        )}
      </header>

      <div className="px-4">
        <div className="mb-4 flex h-40 w-40 items-center justify-center rounded-lg bg-secondary">
          <ListMusic className="h-16 w-16 text-muted-foreground" />
        </div>
        {playlist.description && <p className="mb-2 text-sm text-muted-foreground">{playlist.description}</p>}
        <p className="mb-4 text-xs text-muted-foreground">{songs.length} morceau{songs.length > 1 ? 'x' : ''}</p>

        {songs.length > 0 && (
          <Button className="mb-4" onClick={() => playSongFromList(songs[0], songs)}>
            <Play className="mr-2 h-4 w-4 fill-current" /> Lire tout
          </Button>
        )}

        <div className="space-y-1">
          {songs.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary">
              <button onClick={() => playSongFromList(s, songs)} className="flex flex-1 items-center gap-3">
                <img src={songCoverUrl(s)} alt={s.title} className="h-10 w-10 rounded object-cover" />
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                </div>
              </button>
              {isOwner && (
                <Button variant="ghost" size="icon" onClick={() => removeSong(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
