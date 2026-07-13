import { getPbUrl } from './pocketbase';

/** Sonde le backend PocketBase. Résout `true` s'il répond avant le timeout. */
export function checkBackendReachable(timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, timeoutMs);
    fetch(`${getPbUrl()}/api/health`, { method: 'GET', cache: 'no-store', signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        resolve(res.ok);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

export function quitApp(): void {
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.isElectron && typeof electronAPI.quitApp === 'function') {
    electronAPI.quitApp();
    return;
  }
  window.close();
}
