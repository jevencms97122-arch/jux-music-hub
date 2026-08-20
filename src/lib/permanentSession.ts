/**
 * Préférence "Session permanente" — quand activée, l'app maintient
 * automatiquement une session d'écoute ouverte pendant que l'utilisateur
 * joue de la musique en ligne, permettant à ses abonnés de voir son activité
 * et de la rejoindre à tout moment. Réglage local (par appareil).
 */

const ENABLED_KEY = 'jux_permanent_session_enabled';
const SESSION_ID_KEY = 'jux_permanent_session_id';

export function isPermanentSessionEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPermanentSessionEnabledPref(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    console.error('[permanentSession] Failed to persist preference');
  }
}

/** ID de la session que l'app a auto-créée pour le mode permanent (si active) */
export function getStoredPermanentSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function setStoredPermanentSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SESSION_ID_KEY, id);
    else localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    console.error('[permanentSession] Failed to persist session id');
  }
}
