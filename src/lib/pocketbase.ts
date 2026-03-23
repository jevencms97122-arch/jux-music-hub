import PocketBase from 'pocketbase';

export const pb = new PocketBase('http://188.115.125.74:8090');

export function getFileUrl(record: { id: string; collectionId: string; collectionName: string }, filename: string) {
  return pb.files.getUrl(record, filename);
}

export function getSongCoverUrl(song: { id: string; collectionId: string; collectionName: string; coverImage: string }) {
  if (!song.coverImage) return '/placeholder.svg';
  return getFileUrl(song, song.coverImage);
}

export function getSongAudioUrl(song: { id: string; collectionId: string; collectionName: string; audioFile: string }) {
  return getFileUrl(song, song.audioFile);
}

export function getUserAvatarUrl(user: { id: string; collectionId: string; collectionName: string; avatar: string }) {
  if (!user.avatar) return '';
  return getFileUrl(user, user.avatar);
}
