import { useState, useEffect, useRef } from 'react';
import { loadMedia } from '@/lib/mediaCache';
import { isPerformanceModeEnabled } from '@/hooks/usePerformanceMode';
import { Music2 } from 'lucide-react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  className?: string;
  alt?: string;
  /** Si true, le mode performance n'affecte pas cette image (ex: avatars) */
  exempt?: boolean;
}

export default function CachedImage({
  src,
  fallbackSrc = '/placeholder.svg',
  className = '',
  alt = '',
  exempt = false,
  ...imgProps
}: CachedImageProps) {
  const performanceMode = !exempt && isPerformanceModeEnabled();
  const [displaySrc, setDisplaySrc] = useState<string>(src || fallbackSrc);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
        setDisplaySrc(fallbackSrc);
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
          setDisplaySrc(fallbackSrc);
          setError(true);
        }
      } catch {
        if (!mountedRef.current || cancelled) return;
        setDisplaySrc(fallbackSrc);
        setError(true);
      } finally {
        if (!mountedRef.current || cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => { cancelled = true; };
  }, [src, fallbackSrc, performanceMode]);

  if (performanceMode) {
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
      onError={() => {
        if (!error && displaySrc !== fallbackSrc) {
          setDisplaySrc(fallbackSrc);
          setError(true);
        }
      }}
      {...imgProps}
    />
  );
}
