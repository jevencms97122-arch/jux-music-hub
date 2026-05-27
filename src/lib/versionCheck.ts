/**
 * Utilitaire de vérification de version de l'application PC Jux Desktop.
 * 
 * L'app PC expose un bridge natif via `window.JuxDesktop.getAppVersion()`
 * permettant au site web de connaître sa version et d'afficher
 * une notification de mise à jour si nécessaire.
 * 
 * @see https://github.com/jevencms97122-arch/jux-music-hub
 */

/** Version actuelle de l'app PC à laquelle comparer */
export const LATEST_DESKTOP_VERSION = "1.0.1";

/**
 * Récupère la version de l'application PC.
 * 
 * Méthodes de détection (par ordre de priorité) :
 * 1. window.JuxDesktop.getAppVersion() – API native asynchrone (recommandée)
 * 2. window.__JUX_APP_VERSION – Variable globale synchrone
 * 3. window.getJuxAppVersion() – Fonction utilitaire exposée par le bridge
 * 
 * @returns {Promise<string | null>} La version de l'app ou null si pas sur l'app PC
 */
export async function getDesktopAppVersion(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    // Méthode 1 : via JuxDesktop.getAppVersion() (recommandé)
    if (window.JuxDesktop?.getAppVersion) {
      const version = await Promise.resolve(window.JuxDesktop.getAppVersion());
      if (typeof version === "string" && version.trim()) {
        return version.trim();
      }
    }

    // Méthode 2 : via la variable globale synchrone
    if (window.__JUX_APP_VERSION && typeof window.__JUX_APP_VERSION === "string") {
      return window.__JUX_APP_VERSION.trim();
    }

    // Méthode 3 : via la fonction utilitaire
    if (window.getJuxAppVersion) {
      const version = await Promise.resolve(window.getJuxAppVersion());
      if (typeof version === "string" && version.trim()) {
        return version.trim();
      }
    }
  } catch (err) {
    console.warn("[versionCheck] Erreur lors de la récupération de la version :", err);
  }

  return null;
}

/**
 * Vérifie si une mise à jour est disponible pour l'app PC.
 * 
 * @returns {Promise<{ available: boolean; currentVersion: string | null; latestVersion: string }>}
 */
export async function checkForUpdate(): Promise<{
  available: boolean;
  currentVersion: string | null;
  latestVersion: string;
}> {
  const currentVersion = await getDesktopAppVersion();

  return {
    available: currentVersion !== null && currentVersion !== LATEST_DESKTOP_VERSION,
    currentVersion,
    latestVersion: LATEST_DESKTOP_VERSION,
  };
}

/**
 * Détecte si le site est exécuté dans l'application PC Jux Desktop.
 * 
 * @returns {boolean} true si le site tourne dans l'app PC
 */
export function isRunningInDesktopApp(): boolean {
  if (typeof window === "undefined") return false;

  // Vérification via la disponibilité du bridge natif
  if (window.JuxDesktop?.getAppVersion) return true;
  if (window.__JUX_APP_VERSION) return true;
  if (window.getJuxAppVersion) return true;

  // Fallback : détection via user-agent
  const ua = (navigator.userAgent || "").toLowerCase();
  return ua.includes("jux-music-pc-app") || ua.includes("electron");
}