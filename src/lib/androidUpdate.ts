/**
 * Vérification + installation des mises à jour Android — même backend PocketBase
 * updater que Windows (voir updatePocketbase.ts), mais via le pont natif JuxAndroid
 * (JuxMediaBridge.kt) car tauri-plugin-updater ne supporte pas Android.
 */
import { getVersion } from '@tauri-apps/api/app';
import { getUpdatePbUrl } from '@/lib/updatePocketbase';

export interface AndroidUpdateInfo {
  version: string;
  notes: string | null;
  url: string;
}

/** Renvoie les infos de mise à jour dispo, ou `null` si déjà à jour. Lève en cas d'erreur réseau. */
export async function checkAndroidUpdate(): Promise<AndroidUpdateInfo | null> {
  const v = await getVersion();
  const res = await fetch(`${getUpdatePbUrl()}/api/jux-updater/android/universal/${v}`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { version: data.version, notes: data.notes ?? null, url: data.url };
}

/** Lance le téléchargement + l'ouverture de l'écran d'installation système (JuxMediaBridge.kt). */
export function installAndroidUpdate(url: string): boolean {
  if (!window.JuxAndroid?.downloadAndInstallApk) return false;
  window.JuxAndroid.downloadAndInstallApk(url);
  return true;
}
