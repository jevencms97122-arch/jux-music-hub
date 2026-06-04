import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, Sparkles, Music, Headphones, Heart, Trophy } from 'lucide-react';
import { songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Song } from '@/types/music';

interface WrappedData {
  totalListens: number;
  uniqueSongs: number;
  topSongs: Array<{ song: Song; count: number }>;
  topGenre: string | null;
  topArtist: string | null;
}

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

export default function Wrapped() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const historyRes = await pb.collection('listen_history').getList(1, 500, {
        filter: `user_id = "${user.id}" && listened_at > "${startOfMonth.toISOString()}"`,
        requestKey: null,
      });

      const counts = new Map<string, number>();
      historyRes.items.forEach((h: any) => counts.set(h.get('song_id'), (counts.get(h.get('song_id')) ?? 0) + 1));

      const songIds = [...counts.keys()];
      let topSongs: Array<{ song: Song; count: number }> = [];
      let topGenre: string | null = null;
      let topArtist: string | null = null;

      if (songIds.length > 0) {
        const songsList: Song[] = [];
        for (let i = 0; i < songIds.length; i += 50) {
          const batch = songIds.slice(i, i + 50);
          const filters = batch.map((id: string) => `id = "${id}"`).join(' || ');
          const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
          songsList.push(...res.items.map(recordToSong));
        }
        const songsMap = new Map(songsList.map((s) => [s.id, s]));

        topSongs = [...counts.entries()]
          .map(([id, count]) => ({ song: songsMap.get(id), count }))
          .filter((x) => x.song)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) as Array<{ song: Song; count: number }>;

        const genreCount = new Map<string, number>();
        const artistCount = new Map<string, number>();
        topSongs.forEach(({ song }) => {
          if (song.genre) genreCount.set(song.genre, (genreCount.get(song.genre) ?? 0) + 1);
          if (song.author) artistCount.set(song.author, (artistCount.get(song.author) ?? 0) + 1);
        });
        topGenre = genreCount.size > 0 ? [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
        topArtist = artistCount.size > 0 ? [...artistCount.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
      }

      setData({ totalListens: historyRes.totalItems, uniqueSongs: songIds.length, topSongs, topGenre, topArtist });
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="p-8 text-center">Calcul de ton wrapped...</div>;

  return (
    <div className="relative min-h-screen pb-40 p-4">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Mon Wrapped</h1>
      </header>

      {!data || data.totalListens === 0 ? (
        <p className="text-center text-muted-foreground mt-20">Pas assez d'écoutes ce mois-ci pour générer ton Wrapped.</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-primary p-6 text-center text-primary-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2" />
            <p className="text-lg font-bold">{profile?.pseudo || 'Musicien'}</p>
            <p className="text-sm opacity-80">Ton résumé {monthLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card p-4 text-center">
              <Headphones className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{data.totalListens}</p>
              <p className="text-xs text-muted-foreground">Écoutes</p>
            </div>
            <div className="rounded-xl bg-card p-4 text-center">
              <Music className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{data.uniqueSongs}</p>
              <p className="text-xs text-muted-foreground">Titres uniques</p>
            </div>
          </div>

          {data.topArtist && (
            <div className="rounded-xl bg-card p-4">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Artiste le plus écouté</p>
                  <p className="text-lg font-bold">{data.topArtist}</p>
                </div>
              </div>
            </div>
          )}

          {data.topGenre && (
            <div className="rounded-xl bg-card p-4">
              <div className="flex items-center gap-3">
                <Heart className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Genre préféré</p>
                  <p className="text-lg font-bold">{data.topGenre}</p>
                </div>
              </div>
            </div>
          )}

          {data.topSongs.length > 0 && (
            <div>
              <h2 className="font-bold mb-3">Top 5 titres</h2>
              <div className="space-y-2">
                {data.topSongs.map(({ song, count }, i) => (
                  <div key={song.id} className="flex items-center gap-3 rounded-xl bg-card/50 p-2">
                    <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
                    <img src={songCoverUrl(song)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground">{song.author}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Lien copié ! Partagé ton Wrapped avec tes amis'); }}>
            <Share2 className="h-4 w-4 mr-2" /> Partager mon Wrapped
          </Button>
        </div>
      )}
    </div>
  );
}