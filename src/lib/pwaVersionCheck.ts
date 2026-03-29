import { pb } from './pocketbase';

export interface AppVersion {
  id: string;
  last_version: number;
  description: string;
}

const CURRENT_APP_VERSION = 1;
const VERSION_CHECK_KEY = 'jux_app_version_dismissed';

export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

export function getDismissedVersion(): number | null {
  const dismissed = localStorage.getItem(VERSION_CHECK_KEY);
  return dismissed ? parseInt(dismissed, 10) : null;
}

export function setDismissedVersion(version: number): void {
  localStorage.setItem(VERSION_CHECK_KEY, version.toString());
}

export function clearDismissedVersion(): void {
  localStorage.removeItem(VERSION_CHECK_KEY);
}

export async function checkForUpdates(): Promise<AppVersion | null> {
  try {
    const records = await pb.collection('app_versions').getFullList<AppVersion>({
      sort: '-last_version',
      limit: 1,
    });

    if (records.length === 0) {
      return null;
    }

    const latestVersion = records[0];

    // Check if there's a newer version available
    if (latestVersion.last_version > CURRENT_APP_VERSION) {
      return latestVersion;
    }

    return null;
  } catch (error) {
    console.error('Erreur lors de la vérification de mise à jour:', error);
    return null;
  }
}

export function reloadApp(): void {
  // Clear service worker cache and reload
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.update();
      });
    });
  }
  
  // Force reload with cache bypass
  window.location.reload();
}