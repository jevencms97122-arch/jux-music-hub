/**
 * PocketBase client centralisé.
 */
import PocketBase from 'pocketbase';

// Slash final retiré : un VITE_PB_URL se terminant par "/" produisait des
// doubles slashes ("...8090//api/health") ailleurs dans le code, ce qui
// déclenchait une redirection 307 sans en-têtes CORS → requêtes bloquées.
const PB_URL = (import.meta.env.VITE_PB_URL || 'http://localhost:8090').replace(/\/+$/, '');

export const pb = new PocketBase(PB_URL);

// Auto-refresh de l'auth
pb.autoCancellation(false);

export function getPbUrl(): string {
  return PB_URL;
}

export function isPbConfigured(): boolean {
  return !!PB_URL;
}

export function getFileUrl(collectionIdOrName: string, recordId: string, filename: string): string {
  return `${PB_URL}/api/files/${collectionIdOrName}/${recordId}/${filename}`;
}