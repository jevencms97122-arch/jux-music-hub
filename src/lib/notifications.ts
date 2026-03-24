import { getSongCoverUrl } from './pocketbase';
import type { Song } from '@/types/music';

export async function showMediaNotification(
  song: Song,
  isPlaying: boolean,
  isLiked: boolean = false,
) {
  if (!('Notification' in window)) {
    return;
  }

  // Request permission if needed
  if (Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return;
    }
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const coverUrl = getSongCoverUrl(song);
    console.log('Notification cover URL:', coverUrl);

    // Use MediaSession API for better media controls (if available)
    if ('mediaSession' in navigator) {
      const mediaSession = navigator.mediaSession as any;
      mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.author,
        artwork: [
          {
            src: coverUrl,
            sizes: '256x256',
            type: 'image/jpeg',
          },
          {
            src: coverUrl,
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      });

      mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }

      // Show notification with cover image and actions
    try {
      const notificationOptions: any = {
        body: song.author || 'Artiste inconnu',
        tag: 'media-player',
        requireInteraction: false,
        // Use correct image property for Android to display the cover art
        image: coverUrl,
        badge: '/jux-icon-192.png', // Small icon for the badge area
        // Add action buttons for media controls and favorite (limit to 3 for Android compatibility)
        actions: [
          { action: 'previous', title: '⏮' },
          { action: 'play', title: isPlaying ? '⏸' : '▶' },
          { action: 'like', title: isLiked ? '❤️' : '🤍' },
        ],
      };

      // Ensure we have valid title and author
      const title = song.title || 'Titre inconnu';
      const author = song.author || 'Artiste inconnu';
      
      const notification = new Notification(title, {
        ...notificationOptions,
        body: author
      });

      notification.onclick = () => {
        window.focus();
      };

      console.log('Notification created successfully');
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  } catch (error) {
    console.error('Error showing media notification:', error);
  }
}

export async function closeMediaNotification() {
  if (!('Notification' in window)) {
    return;
  }

  try {
    // Close notifications with tag 'media-player'
    const notifications = await Promise.all([]);
    // We'll need to use service worker for this, but for now we can skip
  } catch (error) {
    console.error('Error closing notification:', error);
  }
}

// Listen for media control messages from UI
export function setupMediaControlListeners(callbacks: {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onLike: () => void;
}) {
  // Setup MediaSession handlers
  if ('mediaSession' in navigator) {
    const mediaSession = navigator.mediaSession as any;

    mediaSession.setActionHandler('play', () => {
      callbacks.onPlay();
    });

    mediaSession.setActionHandler('pause', () => {
      callbacks.onPause();
    });

    mediaSession.setActionHandler('nexttrack', () => {
      callbacks.onNext();
    });

    mediaSession.setActionHandler('previoustrack', () => {
      callbacks.onPrevious();
    });

    // Note: Like/unlike actions may not be supported by all browsers
    try {
      mediaSession.setActionHandler('togglelike', () => {
        callbacks.onLike();
      });
    } catch (e) {
      // Action not supported
    }
  }
}
