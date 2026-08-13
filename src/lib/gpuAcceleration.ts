import { invoke, isTauri } from '@tauri-apps/api/core';

const STORAGE_KEY = 'jux:gpuAcceleration';
const BACKEND_KEY = 'jux:gpuBackend';
const ADAPTER_KEY = 'jux:gpuAdapter';

export type GpuBackend = 'd3d11' | 'd3d11on12' | 'd3d9';
export type GpuAdapter = 'auto' | 'high' | 'low';

/** Par défaut activée : WebView2 utilise déjà le rendu GPU sauf si le pilote
 * est sur la liste noire de Chromium — on force ce cas-là aussi côté Rust. */
export function isGpuAccelerationEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
}

/** Persiste le réglage côté Rust (fichier lu au tout prochain démarrage, avant
 * même que ce JS ne tourne — impossible de passer par le localStorage pour ça).
 * Les arguments du navigateur WebView2 sont figés à sa création : un redémarrage
 * de l'app est nécessaire pour que le changement prenne effet. */
export function setGpuAccelerationEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  if (!isTauri()) return;
  invoke('set_gpu_acceleration', { enabled }).catch(() => {});
}

export function getGpuBackend(): GpuBackend {
  const stored = localStorage.getItem(BACKEND_KEY);
  return stored === 'd3d11on12' || stored === 'd3d9' ? stored : 'd3d11';
}

/** Backend ANGLE (traducteur Chromium → API graphique) — d3d11 par défaut,
 * d3d11on12/d3d9 pour tester la compatibilité sur du matériel plus ancien. */
export function setGpuBackend(backend: GpuBackend): void {
  localStorage.setItem(BACKEND_KEY, backend);
  if (!isTauri()) return;
  invoke('set_gpu_backend', { backend }).catch(() => {});
}

export function getGpuAdapter(): GpuAdapter {
  const stored = localStorage.getItem(ADAPTER_KEY);
  return stored === 'high' || stored === 'low' ? stored : 'auto';
}

/** Quelle carte graphique utiliser sur une machine à double GPU (portable). */
export function setGpuAdapter(pref: GpuAdapter): void {
  localStorage.setItem(ADAPTER_KEY, pref);
  if (!isTauri()) return;
  invoke('set_gpu_adapter', { pref }).catch(() => {});
}

/** Arme un passage en Vulkan pour le tout prochain démarrage uniquement (voir
 * SplashScreen.tsx — combo Ctrl+Alt+V pendant l'animation de démarrage). Le
 * marqueur est consommé dès sa lecture côté Rust, qu'il ait servi ou non :
 * il faut refaire le combo à chaque fois, jamais de bascule permanente. */
export async function armVulkanOnceAndRelaunch(): Promise<void> {
  if (!isTauri()) return;
  await invoke('arm_vulkan_once').catch(() => {});
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
