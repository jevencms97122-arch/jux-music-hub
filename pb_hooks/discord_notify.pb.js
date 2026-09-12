/// <reference path="../pb_data/types.d.ts" />

/**
 * Annonces Discord automatiques :
 *  - nouveau morceau publié -> #infos-ajouts-musiques (titre, artiste(s), publieur, pochette)
 *  - bannière app_banners activée -> #patch-notes (une seule fois par bannière,
 *    voir plus bas pourquoi)
 *
 * Envoi via l'API REST de Discord avec un token de bot (Authorization: Bot ...),
 * en un appel HTTP ponctuel depuis PocketBase — pas de connexion gateway, pas de
 * process à héberger en plus. Le bot doit juste avoir la permission d'écrire
 * dans les deux salons visés (voir pb_migrations/DISCORD_NOTIFY_SETUP.md).
 *
 * Secrets et IDs de salon : jamais en dur ici (ce fichier peut finir versionné) —
 * toujours lus depuis les variables d'environnement du serveur PocketBase :
 *   DISCORD_BOT_TOKEN, DISCORD_MUSIC_CHANNEL_ID, DISCORD_PATCHNOTES_CHANNEL_ID
 *   PB_PUBLIC_URL (optionnel, sinon retombe sur l'URL codée ci-dessous)
 *
 * Chaque hook est volontairement autonome (rien n'est factorisé dans une
 * fonction utilitaire au niveau du fichier) : le JSVM de PocketBase ne rend
 * pas fiable l'appel à une fonction déclarée en haut du fichier depuis
 * l'intérieur d'un callback de hook enregistré ailleurs dans ce même fichier
 * ("ReferenceError: ... is not defined" constaté en prod) — un peu de
 * duplication ici plutôt qu'un piège de portée.
 *
 * API JSVM PocketBase v0.23+ : $os.getenv, $http.send, $app.findFirstRecordByFilter,
 * e.record.get/set, e.app.save — vérifiés sur la doc officielle au moment d'écrire
 * ce hook (contrairement à song_share.pb.js qui utilisait l'ancien $app.dao()).
 */

// ─── Nouveau morceau publié ────────────────────────────────────────────────

onRecordAfterCreateSuccess((e) => {
  try {
    const token = $os.getenv("DISCORD_BOT_TOKEN");
    const channelId = $os.getenv("DISCORD_MUSIC_CHANNEL_ID");
    if (!token || !channelId) {
      console.log("discord_notify (songs): DISCORD_BOT_TOKEN ou DISCORD_MUSIC_CHANNEL_ID manquant");
      e.next();
      return;
    }

    const song = e.record;

    let publisherName = song.getString("uploaded_by");
    try {
      const profile = $app.findFirstRecordByFilter(
        "profiles",
        "user_id = {:uid}",
        { uid: song.getString("uploaded_by") }
      );
      publisherName = profile.getString("pseudo") || publisherName;
    } catch (_) {
      // Profil introuvable : on garde l'id brut plutôt que de bloquer l'annonce.
    }

    const coverFile = song.getString("cover");
    const embed = {
      title: song.getString("title") || "Sans titre",
      description: `**Artiste(s)** : ${song.getString("author") || "Inconnu"}\n**Publié par** : ${publisherName}`,
      color: 0xff6a3d,
    };
    if (coverFile) {
      const base = $os.getenv("PB_PUBLIC_URL") || "http://92.49.99.59:8090";
      // `image` (grande, pleine largeur) plutôt que `thumbnail` (petite vignette
      // en coin, facile à manquer) — une annonce de sortie mérite la pochette
      // bien visible.
      // `song.get("collectionId")` renvoie `null` dans cette version du JSVM
      // (ce n'est pas un champ de données classique) — il faut passer par
      // `.collection()` pour obtenir l'ID réel de la collection.
      embed.image = { url: `${base}/api/files/${song.collection().id}/${song.id}/${coverFile}` };
    }

    const res = $http.send({
      url: `https://discord.com/api/v10/channels/${channelId}/messages`,
      method: "POST",
      headers: { "Authorization": `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
      timeout: 15,
    });
    if (res.statusCode >= 300) {
      console.log("discord_notify (songs): réponse Discord non-2xx", res.statusCode, res.json);
    }
  } catch (err) {
    console.log("discord_notify (songs) error:", err);
  }
  e.next();
}, "songs");

// ─── Bannière app_banners activée ──────────────────────────────────────────

/**
 * Une bannière peut être modifiée plusieurs fois pendant qu'elle est active
 * (ça la refait réapparaître pour les utilisateurs de l'app, comportement
 * volontaire côté app_banners) — mais ça ne doit PAS renvoyer le message
 * Discord à chaque modif. Le champ `discord_notified` (bool) mémorise qu'on a
 * déjà annoncé cette bannière précise. Pour forcer un nouvel envoi sur la
 * même bannière, repasser ce champ à false dans l'admin.
 */
onRecordAfterCreateSuccess((e) => {
  try {
    const banner = e.record;
    if (!banner.getBool("active") || banner.getBool("discord_notified")) {
      e.next();
      return;
    }

    const token = $os.getenv("DISCORD_BOT_TOKEN");
    const channelId = $os.getenv("DISCORD_PATCHNOTES_CHANNEL_ID");
    if (!token || !channelId) {
      console.log("discord_notify (app_banners): DISCORD_BOT_TOKEN ou DISCORD_PATCHNOTES_CHANNEL_ID manquant");
      e.next();
      return;
    }

    const embed = {
      title: banner.getString("title") || "Mise à jour Nexora Music",
      description: banner.getString("message") || "",
      color: 0x22d3ee,
    };
    const version = banner.getString("version_webapp");
    if (version) embed.footer = { text: `Version ${version}` };

    const res = $http.send({
      url: `https://discord.com/api/v10/channels/${channelId}/messages`,
      method: "POST",
      headers: { "Authorization": `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
      timeout: 15,
    });
    if (res.statusCode >= 300) {
      console.log("discord_notify (app_banners): réponse Discord non-2xx", res.statusCode, res.json);
    }

    // Marque la bannière comme annoncée — ce save() redéclenche ce même hook une
    // fois (onRecordAfterUpdateSuccess ci-dessous), mais `discord_notified` sera
    // alors vrai et on ressortira immédiatement à la ligne du dessus : pas de boucle.
    banner.set("discord_notified", true);
    e.app.save(banner);
  } catch (err) {
    console.log("discord_notify (app_banners) error:", err);
  }
  e.next();
}, "app_banners");

onRecordAfterUpdateSuccess((e) => {
  try {
    const banner = e.record;
    if (!banner.getBool("active") || banner.getBool("discord_notified")) {
      e.next();
      return;
    }

    const token = $os.getenv("DISCORD_BOT_TOKEN");
    const channelId = $os.getenv("DISCORD_PATCHNOTES_CHANNEL_ID");
    if (!token || !channelId) {
      console.log("discord_notify (app_banners): DISCORD_BOT_TOKEN ou DISCORD_PATCHNOTES_CHANNEL_ID manquant");
      e.next();
      return;
    }

    const embed = {
      title: banner.getString("title") || "Mise à jour Nexora Music",
      description: banner.getString("message") || "",
      color: 0x22d3ee,
    };
    const version = banner.getString("version_webapp");
    if (version) embed.footer = { text: `Version ${version}` };

    const res = $http.send({
      url: `https://discord.com/api/v10/channels/${channelId}/messages`,
      method: "POST",
      headers: { "Authorization": `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
      timeout: 15,
    });
    if (res.statusCode >= 300) {
      console.log("discord_notify (app_banners): réponse Discord non-2xx", res.statusCode, res.json);
    }

    banner.set("discord_notified", true);
    e.app.save(banner);
  } catch (err) {
    console.log("discord_notify (app_banners) error:", err);
  }
  e.next();
}, "app_banners");
