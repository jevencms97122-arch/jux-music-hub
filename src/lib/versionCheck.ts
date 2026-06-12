/**
 * Utilitaire de vérification de version de l'application Jux (PC Desktop & Android).
 *
 * L'app PC expose un bridge natif via `window.JuxDesktop.getAppVersion()`
 * L'app Android expose un bridge natif via `window.JuxAndroid.getAppVersion()`
 * permettant au site web de connaître sa version et d'afficher
 * une notification de mise à jour si nécessaire.
 */

import type { JuxPlatform } from './platform';

/** Version actuelle de l'app Android */
export const LATEST_ANDROID_VERSION = "1.0.4";

/** Version actuelle de l'app PC */
export const LATEST_PC_VERSION = "1.0.4";

/** URLs de téléchargement selon la plateforme */
export const DOWNLOAD_URLS: Record<Exclude<JuxPlatform, 'web'>, string> = {
  'android-app': "https://juxstore.lovable.app/app/4e44fb8c-839e-494d-b0a9-cf92d9c4fafb?q=",
  'windows-app': "https://juxstore.lovable.app/app/4e44fb8c-839e-494d-b0a9-cf92d9c4fafb?q=",
};

/**
 * Récupère la version de l'application native (PC ou Android).
 *
 * Ordre de détection :
 * 1. window.JuxDesktop.getAppVersion() – App PC (asynchrone)
 * 2. window.JuxAndroid.getAppVersion() – App Android (synchrone)
 * 3. window.__JUX_APP_VERSION – Variable globale (fallback)
 * 4. window.getJuxAppVersion() – Fonction utilitaire (fallback)
 *
 * @returns {Promise<string | null>} La version de l'app ou null si pas disponible
 */
export async function getNativeAppVersion(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    // Méthode 1 : App PC (asynchrone)
    if (window.JuxDesktop?.getAppVersion) {
      const version = await Promise.resolve(window.JuxDesktop.getAppVersion());
      if (typeof version === "string" && version.trim()) {
        return version.trim();
      }
    }

    // Méthode 2 : App Android (synchrone)
    if (window.JuxAndroid?.getAppVersion) {
      const version = window.JuxAndroid.getAppVersion();
      if (typeof version === "string" && version.trim()) {
        return version.trim();
      }
    }

    // Méthode 3 : Variable globale synchrone (fallback)
    if (window.__JUX_APP_VERSION && typeof window.__JUX_APP_VERSION === "string") {
      return window.__JUX_APP_VERSION.trim();
    }

    // Méthode 4 : Fonction utilitaire (fallback)
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
 * Vérifie si une mise à jour est disponible pour l'app native.
 *
 * @returns {Promise<{ available: boolean; currentVersion: string | null; latestVersion: string; platform: JuxPlatform }>}
 */
export async function checkForUpdate(): Promise<{
  available: boolean;
  currentVersion: string | null;
  latestVersion: string;
  platform: JuxPlatform;
}> {
  const currentVersion = await getNativeAppVersion();
  const platform = getDetectedPlatform();
  const latestVersion = platform === 'android-app' ? LATEST_ANDROID_VERSION : LATEST_PC_VERSION;

  return {
    available: currentVersion !== null && currentVersion !== latestVersion,
    currentVersion,
    latestVersion,
    platform,
  };
}

/**
 * Détecte si le site est exécuté dans une application native Jux (PC ou Android).
 *
 * @returns {boolean} true si le site tourne dans l'app native
 */
export function isRunningInNativeApp(): boolean {
  if (typeof window === "undefined") return false;

  // Vérification via la disponibilité du bridge natif
  if (window.JuxDesktop?.getAppVersion) return true;
  if (window.JuxAndroid?.getAppVersion) return true;
  if (window.__JUX_APP_VERSION) return true;
  if (window.getJuxAppVersion) return true;

  // Fallback : détection via user-agent
  const ua = (navigator.userAgent || "").toLowerCase();
  return (
    ua.includes("jux-music-pc-app") ||
    ua.includes("electron") ||
    ua.includes("jux_music") ||
    ua.includes("com.example.jux_music")
  );
}

/**
 * Retourne la plateforme détectée.
 */
export function getDetectedPlatform(): JuxPlatform {
  if (typeof window === "undefined") return 'web';
  const ua = (navigator.userAgent || "").toLowerCase();
  if (window.JuxAndroid || ua.includes("jux_music") || ua.includes("com.example.jux_music")) return 'android-app';
  if (window.JuxDesktop || ua.includes("jux-music-pc-app") || ua.includes("electron")) return 'windows-app';
  return 'web';
}

/**
 * Retourne l'URL de téléchargement selon la plateforme détectée.
 */
export function getDownloadUrl(): string {
  const platform = getDetectedPlatform();
  if (platform === 'android-app') return DOWNLOAD_URLS['android-app'];
  return DOWNLOAD_URLS['windows-app'];
}

/**
 * Retourne les notes de mise à jour selon la plateforme détectée.
 */
export function getReleaseNotes(): string {
  const platform = getDetectedPlatform();
  if (platform === 'android-app') {
    return "Version 1.0.4 (mobile) — Correction d'un bug de mise à jour répétée.";
  }
  // PC Desktop
  return "Version 1.0.4 (PC) — Le serveur a été changé et l'hébergement du site a également été mis à jour.";
}
