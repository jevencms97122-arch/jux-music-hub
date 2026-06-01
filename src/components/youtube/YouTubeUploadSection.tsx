import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Youtube, CheckCircle, Music, Upload as UploadIcon, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import CachedImage from '@/components/CachedImage';

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

      onVideoDetected(videoId, cleanTitle, data.author_name || 'Inconnu');
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
    const videoId = extractVideoId(e.target.value);
    if (videoId) {
      if (autoDetectTimer.current) clearTimeout(autoDetectTimer.current);
      autoDetectTimer.current = setTimeout(() => {
        fetchVideoInfo(videoId);
      }, 800);
    }
  };

  const autoDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // YouTube thumbnail URL
  const thumbnailUrl = detectedVideo?.videoId 
    ? `https://img.youtube.com/vi/${detectedVideo.videoId}/hqdefault.jpg` 
    : null;

  // YouTube video URL for external link
  const youtubeWatchUrl = detectedVideo?.videoId
    ? `https://www.youtube.com/watch?v=${detectedVideo.videoId}`
    : null;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-xl border bg-secondary/20 p-4 space-y-2">
        <div className="flex items-start gap-3">
          <Youtube className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>1. Ouvrez <strong>YouTube</strong> dans un nouvel onglet</p>
            <p>2. Trouvez la musique que vous voulez</p>
            <p>3. Copiez le lien de la vidéo et collez-le ci-dessous</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.open('https://www.youtube.com', '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" />
          Ouvrir YouTube
        </Button>
      </div>

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

      {/* Detected Video Info with Thumbnail */}
      {detectedVideo && (
        <div className="rounded-xl border bg-secondary/30 overflow-hidden">
          {/* YouTube Thumbnail */}
          {thumbnailUrl && (
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <img
                src={thumbnailUrl}
                alt={detectedVideo.title}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  // Fallback if thumbnail fails
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <a
                href={youtubeWatchUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-red-700 transition-colors"
              >
                <Youtube className="h-3 w-3" />
                Voir sur YouTube
              </a>
            </div>
          )}

          <div className="p-4 space-y-2">
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
        </div>
      )}
    </div>
  );
}