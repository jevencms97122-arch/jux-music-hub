/// <reference path="../pb_data/types.d.ts" />

/**
 * Incrémente `playlists.view_count` / `playlists.play_count` en réaction à la
 * création d'une ligne dans `playlist_views` / `playlist_plays`.
 *
 * Pourquoi côté serveur et pas côté client : la règle Update de `playlists`
 * n'autorise (à raison) que le propriétaire à modifier sa playlist. Un
 * visiteur qui écoute une playlist publique de quelqu'un d'autre n'a donc pas
 * le droit d'en incrémenter le compteur lui-même — la tentative échouait
 * silencieusement (l'utilisateur ne voyait aucune erreur, juste un compteur
 * qui ne bougeait jamais). Un hook tourne avec les pleins droits de
 * l'application, indépendamment des règles d'API : il peut mettre à jour
 * `playlists` sans qu'il soit nécessaire d'assouplir sa règle Update (qui
 * resterait sinon un moyen pour n'importe qui de réécrire le titre/la
 * description d'une playlist qui n'est pas la sienne).
 *
 * Le comptage "une fois par personne" reste garanti par l'index unique
 * (playlist_id, user_id) sur playlist_views/playlist_plays (voir
 * PLAYLIST_ENGAGEMENT_SETUP.md) : ce hook ne se déclenche qu'à la création
 * d'une ligne, donc jamais deux fois pour la même personne sur la même playlist.
 *
 * Chaque hook est autonome (pas de fonction partagée en haut du fichier) :
 * même piège de portée JSVM que documenté dans discord_notify.pb.js.
 */

onRecordAfterCreateSuccess((e) => {
  try {
    const playlistId = e.record.get("playlist_id");
    const playlist = $app.findRecordById("playlists", playlistId);
    playlist.set("view_count", (playlist.get("view_count") || 0) + 1);
    e.app.save(playlist);
  } catch (err) {
    console.log("playlist_engagement (views) error:", err);
  }
  e.next();
}, "playlist_views");

onRecordAfterCreateSuccess((e) => {
  try {
    const playlistId = e.record.get("playlist_id");
    const playlist = $app.findRecordById("playlists", playlistId);
    playlist.set("play_count", (playlist.get("play_count") || 0) + 1);
    e.app.save(playlist);
  } catch (err) {
    console.log("playlist_engagement (plays) error:", err);
  }
  e.next();
}, "playlist_plays");
