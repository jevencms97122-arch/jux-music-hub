import "./lib/tauriBridge";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { syncCloseToTray } from "./lib/closeToTray";

// Rust ne connaît pas la préférence "fermer dans la barre des tâches" (stockée en
// localStorage côté JS) tant qu'on ne la lui communique pas explicitement.
syncCloseToTray();

// PWA: skip dans iframe et preview Lovable, désinscrire SWs existants
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app"));

// L'app desktop Tauri embarque déjà le build exact dans le binaire : un Service Worker
// n'y sert à rien et cause un bug grave — son cache persiste dans le profil WebView2
// À TRAVERS les réinstallations, donc une réinstallation peut continuer à servir
// l'ancien JS indéfiniment. On le désactive et on purge tout SW/cache existant.
const isTauriApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// En dev, un SW d'un ancien build sur la même origine servirait une version en cache
if (import.meta.env.DEV || isPreviewHost || isInIframe || isTauriApp) {
  navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if (isTauriApp && "caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
} else if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
