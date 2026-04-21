import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export default function Wrapped() {
  const navigate = useNavigate();
  const { authUser, profile } = useAuth();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: history } = await supabase
        .from('listen_history')
        .select('song_id')
        .eq('user_id', authUser.id)
        .gte('listened_at', startOfMonth.toISOString());

      const counts = new Map<string, number>();
      (history ?? []).forEach((h: any) => counts.set(h.song_id, (counts.get(h.song_id) ?? 0) + 1));

      const songIds = [...counts.keys()];
      let topSongs: Array<{ song: Song; count: number }> = [];
      let topGenre: string | null = null;
      let topArtist: string | null = null;

      if (songIds.length > 0) {
        const { data: songs } = await supabase.from('songs').select('*').in('id', songIds);
        const songsMap = new Map((songs ?? []).map((s: any) => [s.id, s as Song]));

        topSongs = [...counts.entries()]
          .map(([id, count]) => ({ song: songsMap.get(id), count }))
          .filter((x) => x.song)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) as Array<{ song: Song; count: number }>;

        // Top genre/artist
        const genreCount = new Map<string, number>();
        const artistCount = new Map<string, number>();
        counts.forEach((c, sid) => {
          const s = songsMap.get(sid);
          if (s?.genre) genreCount.set(s.genre, (genreCount.get(s.genre) ?? 0) + c);
          if (s?.author) artistCount.set(s.author, (artistCount.get(s.author) ?? 0) + c);
        });
        topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        topArtist = [...artistCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }

      setData({
        totalListens: history?.length ?? 0,
        uniqueSongs: songIds.length,
        topSongs,
        topGenre,
        topArtist,
      });
      setLoading(false);
    })();
  }, [authUser]);

  const share = async () => {
    if (!data) return;
    const text = `Mon mois sur Jux 🎵\n${data.totalListens} écoutes • ${data.uniqueSongs} titres\nTop artiste : ${data.topArtist ?? '—'}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Mon Wrapped Jux', text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Copié dans le presse-papier !');
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <header className="flex items-center gap-2 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-xl font-bold capitalize">Wrapped — {monthLabel}</h1>
        <Button variant="ghost" size="icon" onClick={share}><Share2 className="h-5 w-5" /></Button>
      </header>

      {loading ? (
        <p className="px-6 text-sm text-muted-foreground">Chargement...</p>
      ) : !data || data.totalListens === 0 ? (
        <div className="px-6 py-12 text-center">
          <Sparkles className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune écoute ce mois-ci. Lance une musique pour commencer !</p>
        </div>
      ) : (
        <div className="space-y-4 px-4">
          <div className="rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
            <Sparkles className="h-8 w-8" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider opacity-80">{profile?.pseudo} — {monthLabel}</p>
            <h2 className="mt-1 text-3xl font-black">Ton mois en musique</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Headphones />} value={data.totalListens} label="écoutes" />
            <StatCard icon={<Music />} value={data.uniqueSongs} label="titres uniques" />
          </div>

          {data.topArtist && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top artiste</p>
              <p className="mt-2 text-2xl font-bold">{data.topArtist}</p>
            </div>
          )}

          {data.topGenre && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Genre préféré</p>
              <p className="mt-2 text-2xl font-bold">{data.topGenre}</p>
            </div>
          )}

          {data.topSongs.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top 5 titres</p>
              </div>
              <div className="space-y-2">
                {data.topSongs.map((t, i) => (
                  <div key={t.song.id} className="flex items-center gap-3">
                    <span className="w-6 text-center text-lg font-bold text-primary">{i + 1}</span>
                    <img src={songCoverUrl(t.song)} alt="" className="h-10 w-10 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.song.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.song.author}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={share} className="w-full">
            <Share2 className="mr-2 h-4 w-4" /> Partager mon Wrapped
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="mt-3 text-3xl font-black">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
