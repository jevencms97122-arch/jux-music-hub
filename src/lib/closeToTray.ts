import { invoke, isTauri } from '@tauri-apps/api/core';

const STORAGE_KEY = 'jux:closeToTray';

export function isCloseToTrayEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/** Persiste le réglage et informe immédiatement le process Rust (qui ne connaît
 * pas le localStorage) du nouveau comportement de fermeture voulu. */
export function setCloseToTrayEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  syncCloseToTray();
}

export function syncCloseToTray(): void {
  if (!isTauri()) return;
  invoke('set_close_to_tray', { enabled: isCloseToTrayEnabled() }).catch(() => {});
}
