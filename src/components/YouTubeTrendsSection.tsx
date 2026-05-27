import { useEffect, useMemo, useState } from 'react';
import { Video, TrendingUp, AlertTriangle } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

const DEFAULT_PIPED_BASE = 'https://pipedapi.kavin.rocks';

type TrendingItem = {
  videoId: string;
  title: string;
  uploader: string;
  thumbnail: string;
};

type StreamsResponse = {
  audioStreams?: Array<{
    url: string;
    mimeType?: string;
    bitrate?: number | string;
    quality?: string;
  }>;
};

function truncateText(s: string, max = 42) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function pickBestAudioStream(streams: StreamsResponse | null | undefined) {
  const audioStreams = streams?.audioStreams ?? [];
  if (!audioStreams.length) return null;

  // Prefer opus/webm, then aac/mp4, then a best-effort fallback
  const preferredMimeOrder = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];

  const normalizeMime = (m?: string) => (m || '').toLowerCase();

  const score = (s: StreamsResponse['audioStreams'][number]) => {
    const mime = normalizeMime(s.mimeType);
    const idx = preferredMimeOrder.findIndex((p) => mime.startsWith(p));
    const mimeScore = idx === -1 ? 1000 : idx;

    const brRaw = s.bitrate;
    const br =
      typeof brRaw === 'string'
        ? parseInt(brRaw.replace(/[^\d]/g, ''), 10) || 0
        : brRaw ?? 0;

    // lower is better
    return mimeScore * 1_000_000 + (1000 - Math.min(br, 10_000_000));
  };

  const best = [...audioStreams].sort((a, b) => score(a) - score(b))[0];
  return best?.url ? best : null;
}

function extractTrendingItems(json: any): TrendingItem[] {
  // Piped can return different shapes depending on instance/version.
  const candidates: any[] = json?.items ?? json?.videos ?? json?.data ?? json?.trending ?? [];
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const out: TrendingItem[] = [];
  for (const it of candidates) {
    const videoId =
      it?.videoId ??
      it?.video_id ??
      it?.id ??
      it?.video?.videoId ??
      it?.video?.id;

    const title = it?.title ?? it?.name ?? it?.video?.title;
    const uploader = it?.uploader ?? it?.channel?.name ?? it?.author ?? it?.channelTitle;
    const thumbnail =
      it?.thumbnail ??
      it?.thumbnails?.[0]?.url ??
      it?.videoThumbnails?.[0]?.url ??
      it?.video?.thumbnail ??
      it?.video?.thumbnails?.[0]?.url;

    if (!videoId || !title || !uploader || !thumbnail) continue;

    out.push({
      videoId: String(videoId),
      title: String(title),
      uploader: String(uploader),
      thumbnail: String(thumbnail),
    });
  }
  return out;
}

export default function YouTubeTrendsSection(): JSX.Element {
  const { playExternalAudio } = usePlayer();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const endpointBase = useMemo(() => DEFAULT_PIPED_BASE, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`${endpointBase}/trending?region=FR`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const parsed = extractTrendingItems(json);

        if (!cancelled) setItems(parsed.slice(0, 12));
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message ? String(e.message) : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpointBase]);

  const onClickItem = async (it: TrendingItem) => {
    try {
      setErrorMsg(null);

      const res = await fetch(`${endpointBase}/streams/${it.videoId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as StreamsResponse;
      const best = pickBestAudioStream(json);

      if (!best?.url) throw new Error('Aucun flux audio trouvé');

      playExternalAudio({
        videoId: it.videoId,
        title: it.title,
        author: it.uploader,
        coverUrl: it.thumbnail,
        audioUrl: best.url,
      });
    } catch (e: any) {
      setErrorMsg(e?.message ? String(e.message) : 'Impossible de lire cette tendance');
    }
  };

  return (
    <section className="relative mb-8 px-4">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold text-foreground">À écouter</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-xl bg-secondary"
              style={{ animation: 'fadeIn 0.4s ease-out both', animationDelay: `${0.1 + i * 0.05}s` }}
            />
          ))}
        </div>
      ) : errorMsg ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span>{errorMsg}</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Aucune tendance YouTube trouvée.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, i) => (
            <button
              key={it.videoId}
              onClick={() => onClickItem(it)}
              className="group text-left"
              style={{
                animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
                animationDelay: `${0.1 + i * 0.04}s`,
              }}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-card bg-secondary transition-transform group-hover:scale-[1.02]">
                <img src={it.thumbnail} alt={it.title} loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[11px] text-white/90 backdrop-blur">
                    <Video className="h-2.5 w-2.5" /> YouTube
                  </span>
                </div>
              </div>

              <div className="mt-2">
                <p className="truncate text-sm font-semibold text-foreground">{truncateText(it.title, 42)}</p>
                <p className="truncate text-xs text-muted-foreground">{truncateText(it.uploader, 34)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
