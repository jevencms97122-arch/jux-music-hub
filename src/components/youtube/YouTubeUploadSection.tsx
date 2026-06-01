import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Youtube, CheckCircle, Music, Upload as UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

interface YouTubeUploadSectionProps {
  onVideoDetected: (videoId: string, title: string, author: string) => void;
  detectedVideo: { videoId: string; title: string; author: string } | null;
  onUpload: () => void;
  submitting: boolean;
}

export default function YouTubeUploadSection({
  onVideoDetected,
  detectedVideo,
  onUpload,
  submitting,
}: YouTubeUploadSectionProps) {
  
  const [urlInput, setUrlInput] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerApiReady = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);

  // YouTube IFrame API
  useEffect(() => {
    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const onReady = () => {
      playerApiReady.current = true;
    };

    (window as any).onYouTubeIframeAPIReady = onReady;

    return () => {
      (window as any).onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  const extractVideoId = (url: string): string | null => {
    if (!url.trim()) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.trim().match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const fetchVideoInfo = useCallback(async (videoId: string) => {
    setIsDetecting(true);
    setError('');
    try {
      // Use oEmbed API (no API key needed)
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      
      if (!response.ok) throw new Error('Impossible de récupérer les informations de la vidéo');
      
      const data = await response.json();
      const title = data.title || 'Sans titre';
      let author = data.author_name || 'Inconnu';

      // Clean up title (remove "(Official Video)" etc.)
      const cleanTitle = title
        .replace(/\s*\(Official\s+(Music\s+)?Video\)\s*/i, '')
        .replace(/\s*\(Audio\)\s*/i, '')
        .replace(/\s*\(Lyrics?\)\s*/i, '')
        .replace(/\s*\(HQ\)\s*/i, '')
        .replace(/\s*\(HD\)\s*/i, '')
        .replace(/\s*\(4K\)\s*/i, '')
        .replace(/\s*\(Official\)\s*/i, '')
        .replace(/^[:\s-]+/, '')
        .trim();

      onVideoDetected(videoId, cleanTitle, author);
      currentVideoIdRef.current = videoId;
      toast.success('Vidéo détectée !');
    } catch (err) {
      console.error('oEmbed error:', err);
      // Fallback: just use the videoId with generic info
      onVideoDetected(videoId, 'Vidéo YouTube', 'Artiste YouTube');
      setError('Impossible de récupérer les détails, mais vous pouvez uploader');
    } finally {
      setIsDetecting(false);
    }
  }, [onVideoDetected, toast]);

  const handleDetect = () => {
    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      setError('Lien YouTube invalide. Utilisez youtube.com/watch?v=... ou youtu.be/...');
      return;
    }
    setError('');
    fetchVideoInfo(videoId);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    setError('');
    // Auto-detect when pasting a valid YouTube URL
    const videoId = extractVideoId(e.target.value);
    if (videoId) {
      // Debounce auto-detect
      if (autoDetectTimer.current) clearTimeout(autoDetectTimer.current);
      autoDetectTimer.current = setTimeout(() => {
        fetchVideoInfo(videoId);
      }, 800);
    }
  };

  const autoDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update the iframe src when detected
  const embedUrl = detectedVideo?.videoId
    ? `https://www.youtube.com/embed/${detectedVideo.videoId}?autoplay=0&controls=1&modestbranding=1&rel=0&showinfo=1`
    : 'https://www.youtube.com';

  return (
    <div className="space-y-4">
      {/* YouTube Iframe */}
      <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="YouTube"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Naviguez sur YouTube pour trouver votre musique, puis collez le lien ci-dessous
      </p>

      {/* URL Input + Detect */}
      <div className="space-y-2">
        <Label htmlFor="youtube-detect" className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-red-500" />
          Lien YouTube
        </Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              id="youtube-detect"
              type="url"
              value={urlInput}
              onChange={handleUrlChange}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full"
            />
          </div>
          <Button 
            type="button" 
            onClick={handleDetect}
            disabled={isDetecting || !urlInput.trim()}
            variant="secondary"
          >
            {isDetecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Music className="h-4 w-4" />
            )}
            Détecter
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Detected Video Info */}
      {detectedVideo && (
        <div className="rounded-xl border bg-secondary/30 p-4 space-y-2">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{detectedVideo.title}</p>
              <p className="text-xs text-muted-foreground">{detectedVideo.author}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Youtube className="h-3 w-3 text-red-500" />
              YouTube Music
            </div>
            <div className="flex items-center gap-1">
              <Music className="h-3 w-3" />
              Détection automatique
            </div>
          </div>

          {/* Upload button */}
          <Button
            type="button"
            onClick={onUpload}
            disabled={submitting}
            className="w-full mt-2"
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            {submitting ? 'Upload en cours...' : 'Uploader vers Jux'}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            La vidéo YouTube sera lue en fond avec le son original
          </p>
        </div>
      )}
    </div>
  );
}