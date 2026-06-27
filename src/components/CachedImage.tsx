import { useState, useEffect, useRef } from 'react';
import { loadMedia } from '@/lib/mediaCache';
import { isPerformanceModeEnabled } from '@/hooks/usePerformanceMode';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** L'URL originale de l'image */
  src: string;
  /** URL de fallback si l'image ne se charge pas */
  fallbackSrc?: string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Texte alternatif */
  alt?: string;
}

export default function CachedImage({
  src,
  fallbackSrc = '/placeholder.svg',
  className = '',
  alt = '',
  ...imgProps
}: CachedImageProps) {
  const performanceMode = isPerformanceModeEnabled();
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
    return <div className={`bg-secondary ${className}`} aria-label={alt} />;
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
