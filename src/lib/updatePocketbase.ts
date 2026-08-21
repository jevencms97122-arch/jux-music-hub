/**
 * Client PocketBase du backend de mise à jour (collection app_updates).
 * Backend séparé de celui de l'app (musique) — dédié uniquement au système d'updater Tauri.
 */
import PocketBase from 'pocketbase';

const UPDATE_PB_URL = (import.meta.env.VITE_UPDATE_PB_URL || 'http://188.115.125.74:8085').replace(/\/+$/, '');

export const updatePb = new PocketBase(UPDATE_PB_URL);

export function getUpdatePbUrl(): string {
  return UPDATE_PB_URL;
}
