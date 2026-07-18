import { useState, useEffect, useRef } from 'react';
import { loadMedia } from '@/lib/mediaCache';
import { isPerformanceModeEnabled } from '@/hooks/usePerformanceMode';
import { Music2 } from 'lucide-react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  className?: string;
  alt?: string;
  /** Si true, le mode performance n'affecte pas cette image (ex: avatars) */
  exempt?: boolean;
}

export default function CachedImage({
  src,
  className = '',
  alt = '',
  exempt = false,
  ...imgProps
}: CachedImageProps) {
  const performanceMode = !exempt && isPerformanceModeEnabled();
  const [displaySrc, setDisplaySrc] = useState<string>(src);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(!src);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (performanceMode) return;
    let cancelled = false;

    async function load() {
      if (!src) {
        setError(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const cachedUrl = await loadMedia(src);

        if (!mountedRef.current || cancelled) return;

        if (cachedUrl) {
          setDisplaySrc(cachedUrl);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (!mountedRef.current || cancelled) return;
        setError(true);
      } finally {
        if (!mountedRef.current || cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => { cancelled = true; };
  }, [src, performanceMode]);

  // Pas de cover (vide ou en échec) : logo musique plutôt qu'une image cassée
  if (performanceMode || error) {
    return (
      <div className={`bg-secondary flex items-center justify-center ${className}`} aria-label={alt}>
        <Music2 className="h-1/3 w-1/3 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
      {...imgProps}
    />
  );
}
