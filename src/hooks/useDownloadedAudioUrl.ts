import { useEffect, useState } from 'react';
import { getDownloadedAudioPath, getDownloadedAudioBlobUrl } from '@/lib/offlineCacheSync';
import { songAudioUrl } from '@/lib/storage';
import { detectPlatform } from '@/lib/platform';
import type { Song } from '@/types/music';

/**
 * Hook qui retourne l'URL audio d'une song, en priorité depuis le cache local
 * s'il existe, sinon depuis PocketBase/serveur média
 */
export function useDownloadedAudioUrl(song: Song | null): string {
  const [audioUrl, setAudioUrl] = useState<string>('');

  useEffect(() => {
    if (!song) {
      setAudioUrl('');
      return;
    }

    (async () => {
      // Vérifier si le fichier est téléchargé localement — sur Android, le
      // protocole asset:// (convertFileSrc) coupe la lecture en cours de
      // route, on passe donc par un blob: reconstruit à partir des octets
      // bruts (voir storage.ts::songAudioUrlWithCache pour le détail).
      const cachedPath = detectPlatform() === 'android-app'
        ? await getDownloadedAudioBlobUrl(song.id)
        : await getDownloadedAudioPath(song.id);
      if (cachedPath) {
        setAudioUrl(cachedPath);
      } else {
        // Sinon, utiliser l'URL du serveur
        setAudioUrl(songAudioUrl(song));
      }
    })();
  }, [song]);

  return audioUrl;
}
