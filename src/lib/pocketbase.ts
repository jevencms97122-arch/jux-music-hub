import PocketBase from 'pocketbase';
import type { Song } from '@/types/music';

export const pb = new PocketBase('https://per-healing-tobacco-sender.trycloudflare.com/').autoCancellation(false);

export function getFileUrl(record: { id: string; collectionId: string; collectionName: string }, filename: string) {
  const url = pb.files.getURL(record, filename);
  // Ensure absolute URL
  if (url.startsWith('http')) {
    return url;
  }
  if (url.startsWith('/')) {
    return pb.baseUrl + url;
  }
  return pb.baseUrl + '/' + url;
}

export function getSongCoverUrl(song: { id: string; collectionId: string; collectionName: string; coverImage: string }) {
  if (!song.coverImage) return '/placeholder.svg';
  
  // Use the correct PocketBase file URL format
  // Removed Date.now() to allow browser caching
  const baseUrl = pb.baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
  const url = `${baseUrl}/api/files/${song.collectionName}/${song.id}/${song.coverImage}?thumb=0x256`;
  
  return url;
}

export function getSongAudioUrl(song: { id: string; collectionId: string; collectionName: string; audioFile: string }) {
  return getFileUrl(song, song.audioFile);
}

export function getUserAvatarUrl(user: { id: string; collectionId: string; collectionName: string; avatar: string }) {
  if (!user.avatar) return '';
  return getFileUrl(user, user.avatar);
}

