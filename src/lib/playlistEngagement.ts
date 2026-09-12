import { pb } from './pocketbase';

/**
 * Enregistre une vue ou une écoute "par personne" sur une playlist : crée une
 * ligne dans `playlist_views`/`playlist_plays`, qui échoue silencieusement si
 * cette personne en a déjà une pour cette playlist (index unique sur
 * playlist_id+user_id côté PocketBase — voir PLAYLIST_ENGAGEMENT_SETUP.md).
 *
 * L'incrément de `playlists.view_count`/`play_count` n'est PAS fait ici : un
 * visiteur qui écoute la playlist publique de quelqu'un d'autre n'a pas le
 * droit de modifier cette playlist (règle Update réservée au propriétaire),
 * donc cette étape échouerait pour tout le monde sauf le propriétaire lui-même.
 * C'est un hook PocketBase (pb_hooks/playlist_engagement.pb.js), qui tourne
 * avec les pleins droits de l'app, qui s'en charge en réaction à cette
 * création — voir ce fichier pour le détail.
 */
function recordOnce(
  ledgerCollection: 'playlist_views' | 'playlist_plays',
  playlistId: string,
  userId: string,
): void {
  pb.collection(ledgerCollection).create({ playlist_id: playlistId, user_id: userId }).catch(() => {
    // Déjà enregistré pour cette personne — rien à faire.
  });
}

export const recordPlaylistView = (playlistId: string, userId: string) =>
  recordOnce('playlist_views', playlistId, userId);

export const recordPlaylistPlay = (playlistId: string, userId: string) =>
  recordOnce('playlist_plays', playlistId, userId);
