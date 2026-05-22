import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Play, Trash2, Heart, ListMusic, UserPlus, X } from 'lucide-react';
import { songCoverUrl, avatarUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Playlist, Song, Profile } from '@/types/music';

interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  profile?: Profile;
}

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { playSongFromList } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [liked, setLiked] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

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

    // Charger les collaborateurs
    const { data: collabs } = await supabase
      .from('playlist_collaborators').select('*').eq('playlist_id', id);
    const userIds = (collabs ?? []).map((c: any) => c.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
      setCollaborators((collabs ?? []).map((c: any) => ({
        ...c,
        profile: (profiles ?? []).find((p: any) => p.user_id === c.user_id),
      })));
    } else setCollaborators([]);
  };

  useEffect(() => { load(); }, [id, authUser]);

  // Realtime : nouveaux titres ajoutés par les collaborateurs
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel('playlist-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_songs', filter: `playlist_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const isOwner = authUser && playlist?.owner_id === authUser.id;
  const isCollaborator = authUser && collaborators.some((c) => c.user_id === authUser.id);
  const canEdit = isOwner || isCollaborator;

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

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles').select('*')
      .ilike('pseudo', `%${q}%`).limit(8);
    setSearchResults(((data ?? []) as Profile[]).filter(
      (p) => p.user_id !== playlist?.owner_id && !collaborators.some((c) => c.user_id === p.user_id)
    ));
  };

  const addCollaborator = async (userId: string) => {
    if (!id) return;
    const { error } = await supabase
      .from('playlist_collaborators')
      .insert({ playlist_id: id, user_id: userId, role: 'editor' });
    if (error) { toast.error(error.message); return; }
    toast.success('Collaborateur ajouté');
    setSearchQuery('');
    setSearchResults([]);
    load();
  };

  const removeCollaborator = async (collabId: string) => {
    await supabase.from('playlist_collaborators').delete().eq('id', collabId);
    load();
  };

  if (!playlist) return <div className="p-6 text-sm text-muted-foreground">Chargement...</div>;

  return (
    <div className="min-h-screen pb-40">
      <header className="flex items-center gap-2 p-4" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 truncate font-bold">{playlist.title}</h1>
        {isOwner && (
          <Dialog open={isCollabOpen} onOpenChange={setIsCollabOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon"><UserPlus className="h-5 w-5" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Collaborateurs</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  {collaborators.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun collaborateur.</p>
                  ) : collaborators.map((c) => c.profile && (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-secondary">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={avatarUrl(c.profile)} />
                        <AvatarFallback>{c.profile.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                      </Avatar>
                      <p className="flex-1 text-sm">{c.profile.pseudo}</p>
                      <Button variant="ghost" size="icon" onClick={() => removeCollaborator(c.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  <Input placeholder="Rechercher un utilisateur..." value={searchQuery} onChange={(e) => searchUsers(e.target.value)} />
                  <div className="mt-2 space-y-1">
                    {searchResults.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => addCollaborator(p.user_id)}
                        className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-secondary"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={avatarUrl(p)} />
                          <AvatarFallback>{p.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm">{p.pseudo}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
        <div className="mb-4 flex h-40 w-40 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant" style={{ animation: 'scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '0.1s' }}>
          <ListMusic className="h-16 w-16 text-primary-foreground" />
        </div>
        {playlist.description && <p className="mb-2 text-sm text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.2s' }}>{playlist.description}</p>}
        <p className="mb-2 text-xs text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.25s' }}>
          {songs.length} morceau{songs.length > 1 ? 'x' : ''}
          {collaborators.length > 0 && ` • ${collaborators.length} collaborateur${collaborators.length > 1 ? 's' : ''}`}
        </p>

        {collaborators.length > 0 && (
          <div className="mb-4 flex -space-x-2" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.3s' }}>
            {collaborators.slice(0, 5).map((c) => c.profile && (
              <Avatar key={c.id} className="h-8 w-8 ring-2 ring-background">
                <AvatarImage src={avatarUrl(c.profile)} />
                <AvatarFallback className="text-[10px]">{c.profile.pseudo?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}

        {songs.length > 0 && (
          <Button className="mb-4" onClick={() => playSongFromList(songs[0], songs)} style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.35s' }}>
            <Play className="mr-2 h-4 w-4 fill-current" /> Lire tout
          </Button>
        )}

        <div className="space-y-1">
          {songs.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary"
              style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.4 + i * 0.04}s` }}
            >
              <button onClick={() => playSongFromList(s, songs)} className="flex flex-1 items-center gap-3">
                <img src={songCoverUrl(s)} alt={s.title} className="h-10 w-10 rounded object-cover" />
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                </div>
              </button>
              {canEdit && (
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