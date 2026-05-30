import { useEffect, useRef, useState } from 'react';
import { songCoverUrl } from '@/lib/storage';
import CachedImage from '@/components/CachedImage';
import type { Song } from '@/types/music';

interface SynchronizedVideoPlayerProps {
  song: Song;
  isPlaying: boolean;
  currentTime: number;
  onReady?: () => void;
  /** If true, renders as a full-background video behind content */
  asBackground?: boolean;
}

const TIMEOUT_MS = 4000; // 4 secondes max pour charger la vidéo

export default function SynchronizedVideoPlayer({
  song,
  isPlaying,
  currentTime,
  onReady,
  asBackground = false,
}: SynchronizedVideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoUrl = song.video_url || null;
  const youtubeId = videoUrl ? extractYoutubeIdFromEmbed(videoUrl) : null;
  const lastPlayStateRef = useRef<boolean | null>(null);
  const readyCalledRef = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  // Timer de 4 secondes
  useEffect(() => {
    if (!youtubeId) return;
    const timer = setTimeout(() => {
      if (!readyCalledRef.current) {
        setTimedOut(true);
        readyCalledRef.current = true;
        onReady?.();
      }
    }, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [youtubeId, onReady]);

  // Au chargement de l'iframe
  const handleLoad = () => {
    if (!youtubeId) return;

    if (!readyCalledRef.current) {
      readyCalledRef.current = true;
      onReady?.();
    }

    sendCommand('seekTo', [currentTime, true]);

    setTimeout(() => {
      if (isPlaying) sendCommand('playVideo');
    }, 200);
  };

  const sendCommand = (func: string, args: any = '') => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch {}
  };

  // Play/Pause quand l'état change
  useEffect(() => {
    if (!youtubeId || timedOut) return;
    if (lastPlayStateRef.current === isPlaying) return;
    lastPlayStateRef.current = isPlaying;

    if (isPlaying) {
      sendCommand('playVideo');
    } else {
      sendCommand('pauseVideo');
    }
  }, [isPlaying, youtubeId, timedOut]);

  if (!youtubeId) {
    // Fallback cover si background mode
    if (asBackground) {
      return (
        <div className="absolute inset-0">
          <CachedImage
            src={songCoverUrl(song)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
      );
    }
    return null;
  }

  // Si timeout : afficher la cover à la place
  if (timedOut) {
    const fallback = (
      <CachedImage
        src={songCoverUrl(song)}
        alt={song.title}
        className="max-h-[calc(100dvh-480px)] w-full rounded-2xl object-contain shadow-elegant sm:aspect-square sm:object-cover"
      />
    );
    if (asBackground) {
      return (
        <div className="absolute inset-0">
          <CachedImage
            src={songCoverUrl(song)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
      );
    }
    return fallback;
  }

  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&mute=1&playsinline=1&disablekb=1&fs=0&cc_load_policy=0`;

  // Background mode: fullscreen cover video with dark overlay
  if (asBackground) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="YouTube video player"
          className="absolute left-1/2 top-1/2 min-h-[130%] min-w-[130%] -translate-x-1/2 -translate-y-1/2 scale-[1.3]"
          onLoad={handleLoad}
          allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ pointerEvents: 'none', opacity: 0.35 }}
        />
          <div className="absolute inset-0 bg-black/35" />
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-elegant" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="YouTube video player"
        className="absolute inset-0 h-full w-full"
        onLoad={handleLoad}
        allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}

/** Extrait l'ID YouTube depuis n'importe quel format YouTube */
function extractYoutubeIdFromEmbed(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}