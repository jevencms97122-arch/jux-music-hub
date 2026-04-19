import type { Song } from '@/types/music';
import { songCoverUrl } from '@/lib/storage';

/** Met à jour les métadonnées MediaSession (notification système / écran verrouillé). */
export function setMediaSessionMetadata(song: Song | null) {
  if (!('mediaSession' in navigator)) return;
  if (!song) {
    navigator.mediaSession.metadata = null;
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.author,
    album: 'Jux',
    artwork: [
      { src: songCoverUrl(song), sizes: '512x512', type: 'image/png' },
    ],
  });
}

export function setMediaSessionHandlers(handlers: {
  play?: () => void;
  pause?: () => void;
  next?: () => void;
  previous?: () => void;
  seek?: (time: number) => void;
}) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('play', handlers.play ?? null);
    navigator.mediaSession.setActionHandler('pause', handlers.pause ?? null);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.next ?? null);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.previous ?? null);
    if (handlers.seek) {
      navigator.mediaSession.setActionHandler('seekto', (e) => {
        if (e.seekTime != null) handlers.seek!(e.seekTime);
      });
    }
  } catch (e) {
    console.warn('MediaSession handler error', e);
  }
}

export function setMediaSessionPosition(duration: number, position: number, rate = 1) {
  if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
  if (!isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.min(position, duration),
      playbackRate: rate,
    });
  } catch {
    // ignore
  }
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto'].forEach((a) => {
    try { navigator.mediaSession.setActionHandler(a as MediaSessionAction, null); } catch { /* noop */ }
  });
}
