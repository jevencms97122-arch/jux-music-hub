import { getSongCoverUrl } from './pocketbase';
import type { Song } from '@/types/music';

let currentNotification: Notification | null = null;

export async function showMediaNotification(
  song: Song,
  isPlaying: boolean,
  isLiked: boolean = false,
) {
  // Use MediaSession API for system-level media controls (lock screen, notification shade)
  if ('mediaSession' in navigator) {
    const coverUrl = getSongCoverUrl(song);
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title || 'Titre inconnu',
      artist: song.expand?.uploadedBy?.pseudo || song.author || 'Artiste inconnu',
      album: 'Jux Music',
      artwork: [
        { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
        { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
}

export async function updateMediaPosition(position: number, duration: number, playbackRate: number = 1) {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    try {
      if (duration > 0 && isFinite(duration) && isFinite(position)) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackRate,
          position: Math.min(position, duration),
        });
      }
    } catch {
      // Some browsers don't support this
    }
  }
}

export async function closeMediaNotification() {
  if (currentNotification) {
    currentNotification.close();
    currentNotification = null;
  }
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}

export function setupMediaControlListeners(callbacks: {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
}) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', callbacks.onPlay);
  navigator.mediaSession.setActionHandler('pause', callbacks.onPause);
  navigator.mediaSession.setActionHandler('nexttrack', callbacks.onNext);
  navigator.mediaSession.setActionHandler('previoustrack', callbacks.onPrevious);
  
  if (callbacks.onSeekBackward) {
    try {
      navigator.mediaSession.setActionHandler('seekbackward', callbacks.onSeekBackward);
    } catch { /* not supported */ }
  }
  if (callbacks.onSeekForward) {
    try {
      navigator.mediaSession.setActionHandler('seekforward', callbacks.onSeekForward);
    } catch { /* not supported */ }
  }
}

export function clearMediaControlListeners() {
  if (!('mediaSession' in navigator)) return;
  
  try {
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
  } catch { /* ignore */ }
}
