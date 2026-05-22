import type { Song } from '@/types/music';
import { songCoverUrl } from '@/lib/storage';

/** Devine le mime-type à partir de l'extension d'URL. */
function guessImageMime(url: string): string {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  if (u.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

/** Met à jour les métadonnées MediaSession (notification système / écran verrouillé). */
export function setMediaSessionMetadata(song: Song | null) {
  if (!('mediaSession' in navigator)) return;
  if (!song) {
    try { navigator.mediaSession.metadata = null; } catch { /* noop */ }
    return;
  }
  const cover = songCoverUrl(song);
  const mime = guessImageMime(cover);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title || 'Sans titre',
      artist: song.author || 'Inconnu',
      album: 'Jux',
      // Plusieurs tailles pour qu'Android/Chrome choisissent la meilleure.
      artwork: [
        { src: cover, sizes: '96x96', type: mime },
        { src: cover, sizes: '192x192', type: mime },
        { src: cover, sizes: '256x256', type: mime },
        { src: cover, sizes: '384x384', type: mime },
        { src: cover, sizes: '512x512', type: mime },
      ],
    });
    if ('playbackState' in navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing';
    }
  } catch (e) {
    console.warn('MediaSession metadata error', e);
  }
}

export function setMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = state; } catch { /* noop */ }
}

export function setMediaSessionHandlers(handlers: {
  play?: () => void;
  pause?: () => void;
  next?: () => void;
  previous?: () => void;
  seek?: (time: number) => void;
  seekForward?: () => void;
  seekBackward?: () => void;
  stop?: () => void;
}) {
  if (!('mediaSession' in navigator)) return;
  const safe = (action: MediaSessionAction, fn: (() => void) | ((d: any) => void) | null) => {
    try { navigator.mediaSession.setActionHandler(action, fn as any); } catch { /* unsupported */ }
  };
  safe('play', handlers.play ?? null);
  safe('pause', handlers.pause ?? null);
  safe('nexttrack', handlers.next ?? null);
  safe('previoustrack', handlers.previous ?? null);
  safe('stop', handlers.stop ?? null);
  safe('seekforward', handlers.seekForward ?? null);
  safe('seekbackward', handlers.seekBackward ?? null);
  if (handlers.seek) {
    safe('seekto', (e: any) => {
      if (e?.seekTime != null) handlers.seek!(e.seekTime);
    });
  } else {
    safe('seekto', null);
  }
}

export function setMediaSessionPosition(duration: number, position: number, rate = 1) {
  if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
  if (!isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.max(0, Math.min(position, duration)),
      playbackRate: rate || 1,
    });
  } catch {
    // ignore
  }
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.metadata = null; } catch { /* noop */ }
  try { navigator.mediaSession.playbackState = 'none'; } catch { /* noop */ }
  (['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekforward', 'seekbackward', 'stop'] as MediaSessionAction[])
    .forEach((a) => { try { navigator.mediaSession.setActionHandler(a, null); } catch { /* noop */ } });
}
