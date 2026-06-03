/**
 * PocketBase client centralisé.
 * Remplace complètement Supabase.
 */
import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_PB_URL || 'http://188.115.125.74:8090';

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