import { useEffect, useState } from 'react';

export type BannerMediaMode = 'video' | 'image' | 'failed';

/**
 * Un lien de bannière n'est pas toujours une vidéo : un GIF partagé depuis GIPHY,
 * Tenor ou ailleurs (ex: .../giphy.gif) est une image animée — la balise <video>
 * ne sait pas la décoder et déclenche silencieusement une erreur. On tente donc
 * d'abord en vidéo (cas courant : .mp4/.webm), et si ça échoue on retente en
 * image (GIF, PNG, JPG...) avant de considérer le lien invalide.
 */
export function useBannerMediaMode(url: string | null | undefined) {
  const [mode, setMode] = useState<BannerMediaMode>('video');
  useEffect(() => { setMode('video'); }, [url]);

  const onVideoError = () => setMode((m) => (m === 'video' ? 'image' : m));
  const onImageError = () => setMode('failed');

  return { mode, onVideoError, onImageError };
}
