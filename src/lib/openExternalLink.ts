import { isTauri } from '@tauri-apps/api/core';

/**
 * Ouvre une URL dans le navigateur par défaut de l'appareil (et non dans la
 * WebView de l'app), nécessaire par ex. pour les liens Discord dont le
 * navigateur relaie ensuite l'ouverture vers l'app Discord installée.
 */
export async function openExternalLink(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (e) {
      console.error('openExternalLink via Tauri failed', e);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
