import { useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Share2, Sparkles, Music, Headphones, Heart, Trophy, Download } from 'lucide-react';
import { songCoverUrl } from '@/lib/storage';
import { toast } from 'sonner';
import type { Song } from '@/types/music';
import { recordToSong } from '@/lib/pbUtils';

interface WrappedData {
  totalListens: number;
  uniqueSongs: number;
  topSongs: Array<{ song: Song; count: number }>;
  topGenre: string | null;
  topArtist: string | null;
}

export default function Wrapped() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const generateCard = useCallback(async () => {
    if (!data || !profile) return;
    setGenerating(true);
    try {
      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;

      // Fond dégradé violet/noir
      const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      grad.addColorStop(0, '#1a0533');
      grad.addColorStop(0.5, '#2d0f5e');
      grad.addColorStop(1, '#0a0a1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Halo décoratif
      const halo = ctx.createRadialGradient(SIZE * 0.7, SIZE * 0.2, 0, SIZE * 0.7, SIZE * 0.2, SIZE * 0.5);
      halo.addColorStop(0, 'rgba(139,92,246,0.35)');
      halo.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Cover de la top song (si dispo)
      if (data.topSongs[0]) {
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = songCoverUrl(data.topSongs[0].song);
          });
          // Cover floutée en arrière-plan (50% opacité)
          ctx.globalAlpha = 0.12;
          ctx.drawImage(img, SIZE * 0.5, SIZE * 0.35, SIZE * 0.55, SIZE * 0.55);
          ctx.globalAlpha = 1;

          // Cover nette en bas à droite
          const coverSize = 200;
          const rx = SIZE - coverSize - 60;
          const ry = SIZE - coverSize - 130;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(rx, ry, coverSize, coverSize, 20);
          ctx.clip();
          ctx.drawImage(img, rx, ry, coverSize, coverSize);
          ctx.restore();
        } catch {}
      }

      // ── Textes ──
      ctx.textBaseline = 'top';

      // "JUX" logo
      ctx.font = 'bold 90px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.fillText('JUX', 60, 60);
      ctx.globalAlpha = 1;

      // Mois
      ctx.font = '32px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), 60, 170);

      // Pseudo
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      const pseudo = profile.pseudo || 'Musicien';
      ctx.fillText(pseudo.length > 18 ? pseudo.slice(0, 18) + '…' : pseudo, 60, 230);

      // Séparateur
      ctx.strokeStyle = 'rgba(139,92,246,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 320);
      ctx.lineTo(460, 320);
      ctx.stroke();

      // Stats
      ctx.font = 'bold 100px system-ui, sans-serif';
      ctx.fillStyle = '#a78bfa';
      ctx.fillText(String(data.totalListens), 60, 360);

      ctx.font = '34px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('écoutes ce mois', 60, 485);

      // Top artist
      if (data.topArtist) {
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('ARTISTE PRÉFÉRÉ', 60, 580);
        ctx.font = 'bold 44px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        const a = data.topArtist.length > 22 ? data.topArtist.slice(0, 22) + '…' : data.topArtist;
        ctx.fillText(a, 60, 620);
      }

      // Top genre
      if (data.topGenre) {
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('GENRE FAVORI', 60, 720);
        ctx.font = 'bold 44px system-ui, sans-serif';
        ctx.fillStyle = '#a78bfa';
        ctx.fillText(data.topGenre, 60, 760);
      }

      // Top song label
      if (data.topSongs[0]) {
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText('TOP TITRE', 60, 860);
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        const t = data.topSongs[0].song.title;
        ctx.fillText(t.length > 26 ? t.slice(0, 26) + '…' : t, 60, 898);
      }

      // Branding bas
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('Jux-Music disponible sur Jux-Store', 60, SIZE - 72);
      ctx.fillText('juxstore.lovable.app', 60, SIZE - 36);

      // Téléchargement
      const link = document.createElement('a');
      link.download = `jux-wrapped-${new Date().getFullYear()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Carte téléchargée !');
    } catch {
      toast.error('Erreur lors de la génération');
    }
    setGenerating(false);
  }, [data, profile, monthLabel]);

  useEffect(() => {
    const authId = pb.authStore.model?.id;
    if (!authId) return;

    (async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Format attendu par PocketBase : "YYYY-MM-DD HH:MM:SS.sssZ"
        const startStr = startOfMonth.toISOString().replace('T', ' ');

        // getFullList récupère TOUS les enregistrements (pas de limite à 500)
        const historyItems = await pb.collection('listen_history').getFullList({
          filter: `user_id = "${authId}" && listened_at >= "${startStr}"`,
          requestKey: null,
        });

        const counts = new Map<string, number>();
        historyItems.forEach((h: any) => {
          if (h.song_id) counts.set(h.song_id, (counts.get(h.song_id) ?? 0) + 1);
        });

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

          // Compte genre/artiste sur TOUTES les écoutes (pas juste le top 5)
          const genreCount = new Map<string, number>();
          const artistCount = new Map<string, number>();
          historyItems.forEach((h: any) => {
            const song = songsMap.get(h.song_id);
            if (song?.genre) genreCount.set(song.genre, (genreCount.get(song.genre) ?? 0) + 1);
            if (song?.author) artistCount.set(song.author, (artistCount.get(song.author) ?? 0) + 1);
          });
          topGenre = genreCount.size > 0 ? [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
          topArtist = artistCount.size > 0 ? [...artistCount.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
        }

        setData({ totalListens: historyItems.length, uniqueSongs: songIds.length, topSongs, topGenre, topArtist });
      } catch (err) {
        console.error('Wrapped fetch error:', err);
        setData({ totalListens: 0, uniqueSongs: 0, topSongs: [], topGenre: null, topArtist: null });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Lien copié !'); }}>
              <Share2 className="h-4 w-4 mr-2" /> Partager
            </Button>
            <Button className="flex-1 bg-gradient-primary" onClick={generateCard} disabled={generating}>
              <Download className="h-4 w-4 mr-2" />
              {generating ? 'Génération…' : 'Télécharger la carte'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}