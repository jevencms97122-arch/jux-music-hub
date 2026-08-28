import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { recordToSong } from '@/lib/pbUtils';
import { songCoverUrl } from '@/lib/storage';
import type { Song } from '@/types/music';
import { Loader2, Music2, Clock, Mic2, TrendingUp, TrendingDown } from 'lucide-react';

interface RecapData {
  totalListens: number;
  totalMinutes: number;
  topSongs: Array<{ song: Song; count: number }>;
  topArtist: string | null;
  prevWeekTotal: number;
}

/** Début (lundi 00:00) de la semaine glissante courante et de la précédente. */
function weekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche
  const diffToMonday = (day + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  const startOfPrevWeek = new Date(startOfWeek);
  startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);
  return { startOfWeek, startOfPrevWeek };
}

export default function WeeklyRecapSheet({ trigger }: { trigger: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecapData | null>(null);

  const load = async () => {
    if (!user || data) return;
    setLoading(true);
    try {
      const { startOfWeek, startOfPrevWeek } = weekBounds();
      const startStr = startOfWeek.toISOString().replace('T', ' ');
      const prevStartStr = startOfPrevWeek.toISOString().replace('T', ' ');

      const historyItems = await pb.collection('listen_history').getFullList({
        filter: `user_id = "${user.id}" && listened_at >= "${startStr}"`,
        requestKey: null,
      });

      let prevWeekTotal = 0;
      try {
        const prevRes = await pb.collection('listen_history').getList(1, 1, {
          filter: `user_id = "${user.id}" && listened_at >= "${prevStartStr}" && listened_at < "${startStr}"`,
          requestKey: null,
        });
        prevWeekTotal = prevRes.totalItems;
      } catch { /* comparaison optionnelle */ }

      const counts = new Map<string, number>();
      historyItems.forEach((h: any) => { if (h.song_id) counts.set(h.song_id, (counts.get(h.song_id) ?? 0) + 1); });

      const songIds = [...counts.keys()];
      let topSongs: Array<{ song: Song; count: number }> = [];
      let topArtist: string | null = null;
      let totalMinutes = 0;

      if (songIds.length > 0) {
        const songsList: Song[] = [];
        for (let i = 0; i < songIds.length; i += 50) {
          const batch = songIds.slice(i, i + 50);
          const filters = batch.map((id) => `id = "${id}"`).join(' || ');
          const res = await pb.collection('songs').getList(1, 50, { filter: filters, requestKey: null });
          songsList.push(...res.items.map(recordToSong));
        }
        const songsMap = new Map(songsList.map((s) => [s.id, s]));

        topSongs = [...counts.entries()]
          .map(([id, count]) => ({ song: songsMap.get(id), count }))
          .filter((x) => x.song)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) as Array<{ song: Song; count: number }>;

        const artistCount = new Map<string, number>();
        let totalSeconds = 0;
        historyItems.forEach((h: any) => {
          const song = songsMap.get(h.song_id);
          if (song?.author) artistCount.set(song.author, (artistCount.get(song.author) ?? 0) + 1);
          totalSeconds += song?.duration || 210;
        });
        totalMinutes = Math.round(totalSeconds / 60);
        const topArtistEntry = artistCount.size > 0 ? [...artistCount.entries()].sort((a, b) => b[1] - a[1])[0] : null;
        topArtist = topArtistEntry ? topArtistEntry[0] : null;
      }

      setData({ totalListens: historyItems.length, totalMinutes, topSongs, topArtist, prevWeekTotal });
    } catch (err) {
      console.error('Weekly recap fetch error:', err);
      setData({ totalListens: 0, totalMinutes: 0, topSongs: [], topArtist: null, prevWeekTotal: 0 });
    } finally {
      setLoading(false);
    }
  };

  const delta = data ? data.totalListens - data.prevWeekTotal : 0;

  return (
    <Sheet onOpenChange={(open) => { if (open) load(); }}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle>Ton récap de la semaine</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Calcul en cours...</span>
            </div>
          )}

          {!loading && data && data.totalListens === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Pas encore d'écoute cette semaine — reviens plus tard !
            </p>
          )}

          {!loading && data && data.totalListens > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Music2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold leading-none">{data.totalListens}</div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">Écoutes</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold leading-none">{data.totalMinutes} min</div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">Écouté</div>
                  </div>
                </div>
              </div>

              {data.prevWeekTotal > 0 && (
                <div className={`flex items-center gap-2 rounded-2xl border border-border/50 bg-card/40 p-3 text-sm ${delta >= 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  {delta >= 0 ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
                  <span>
                    {delta === 0 ? 'Autant que la semaine dernière' : delta > 0
                      ? `${delta} écoute${delta > 1 ? 's' : ''} de plus que la semaine dernière`
                      : `${Math.abs(delta)} écoute${Math.abs(delta) > 1 ? 's' : ''} de moins que la semaine dernière`}
                  </span>
                </div>
              )}

              {data.topArtist && (
                <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Mic2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{data.topArtist}</div>
                    <div className="text-[11px] text-muted-foreground">Artiste le plus écouté</div>
                  </div>
                </div>
              )}

              {data.topSongs.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-muted-foreground">Top morceaux</div>
                  <div className="space-y-2">
                    {data.topSongs.map(({ song, count }, i) => (
                      <div key={song.id} className="flex items-center gap-3 rounded-xl bg-card/40 p-2">
                        <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                        <img src={songCoverUrl(song)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{song.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{song.author}</div>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">{count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
