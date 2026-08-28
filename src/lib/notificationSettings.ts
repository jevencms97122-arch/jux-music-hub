import type { SmartNotifType } from './smartNotifications';

/**
 * Préférences de notifications par catégorie — gate unique utilisé par
 * sendSmartNotification (voir smartNotifications.ts), donc applicable sur toutes
 * les plateformes (web, Windows, Android) puisque c'est le même point d'entrée
 * partout. Les messages ('new_message') sont volontairement verrouillés activés :
 * setNotificationCategoryEnabled les ignore silencieusement.
 */

const STORAGE_KEY = 'jux:notificationSettings';
const ALWAYS_ON: SmartNotifType[] = ['new_message'];

const DEFAULTS: Record<SmartNotifType, boolean> = {
  friend_request: true,
  session_invite: true,
  friend_listening: true,
  generic: true,
  new_message: true,
};

function readAll(): Record<SmartNotifType, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function isNotificationCategoryEnabled(category: SmartNotifType): boolean {
  if (ALWAYS_ON.includes(category)) return true;
  return readAll()[category] !== false;
}

export function setNotificationCategoryEnabled(category: SmartNotifType, enabled: boolean): void {
  if (ALWAYS_ON.includes(category)) return;
  const all = readAll();
  all[category] = enabled;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
}

export function getAllNotificationSettings(): Record<SmartNotifType, boolean> {
  return readAll();
}

export function isNotificationCategoryLocked(category: SmartNotifType): boolean {
  return ALWAYS_ON.includes(category);
}
