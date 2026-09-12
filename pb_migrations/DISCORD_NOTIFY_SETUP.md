# 🔔 Annonces Discord automatiques (`pb_hooks/discord_notify.pb.js`)

Deux annonces automatiques, envoyées par PocketBase lui-même via l'API REST de
Discord (aucun bot à faire tourner en continu, aucune connexion gateway) :

- **Nouveau morceau publié** → salon `#infos-ajouts-musiques` : titre, artiste(s),
  publieur, pochette en vignette.
- **Bannière `app_banners` activée** → salon `#patch-notes` : titre + message,
  **une seule fois par bannière** même si elle est modifiée ensuite.

---

## 1️⃣ Créer le bot Discord (si pas déjà fait)

1. [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. Onglet **Bot** → **Reset Token** → copie le token (⚠️ ne le partage/colle nulle part en clair, ni dans un fichier versionné).
3. Onglet **OAuth2 → URL Generator** :
   - Scopes : `bot`
   - Permissions du bot : `Send Messages`, `Embed Links`
4. Ouvre l'URL générée, ajoute le bot à ton serveur Discord.
5. Vérifie que le bot a bien accès (voit/peut écrire) aux deux salons `#patch-notes` et `#infos-ajouts-musiques`.

## 2️⃣ Récupérer les IDs des deux salons

Dans Discord : **Paramètres utilisateur → Avancés → Mode développeur** (activer),
puis clic droit sur chaque salon → **Copier l'identifiant du salon**.

## 3️⃣ Variables d'environnement sur le serveur PocketBase

À définir dans l'environnement du **process PocketBase** (pas dans le repo, pas
dans `.env` du frontend — ce sont des secrets serveur) :

| Variable | Valeur |
|---|---|
| `DISCORD_BOT_TOKEN` | Le token du bot (étape 1) |
| `DISCORD_MUSIC_CHANNEL_ID` | ID du salon `#infos-ajouts-musiques` |
| `DISCORD_PATCHNOTES_CHANNEL_ID` | ID du salon `#patch-notes` |
| `PB_PUBLIC_URL` | (optionnel) URL publique de PocketBase, pour construire le lien de la pochette. Par défaut : `http://92.49.99.59:8090` |

Selon comment PocketBase est lancé sur ton serveur (service systemd, Docker,
script...), la façon de définir ces variables diffère — dis-moi comment il
tourne si tu veux que je te donne la commande exacte.

Après avoir défini les variables, **redémarrer PocketBase** pour qu'il les relise.

## 4️⃣ Ajouter le champ à la collection `app_banners`

Dans l'admin PocketBase (**Collections → app_banners → onglet Champs**) :

| Nom | Type | Requis | Détails |
|---|---|---|---|
| `discord_notified` | Booléen | ❌ | Coché automatiquement par le hook après le premier envoi Discord — ne pas cocher à la main sauf pour forcer un renvoi (voir plus bas) |

Aucune règle d'API à changer — ce champ n'est écrit que côté serveur (par le hook), jamais par le client.

## 5️⃣ Comment ça se déclenche

- **Morceau** : dès qu'un `pb.collection('songs').create(...)` réussit — automatique, rien à faire à chaque upload.
- **Bannière** : dès qu'une bannière passe (à la création ou à une modification) avec `active = true` **et** `discord_notified` pas encore coché. Une fois envoyée, `discord_notified` passe à `true` tout seul — les modifications suivantes de cette bannière ne renvoient plus rien sur Discord (même si elle réapparaît dans l'app, ce comportement-là est normal et volontaire, voir `BANNIERE_SETUP.md`).
- **Renvoyer une annonce déjà faite** (ex: tu as corrigé une typo et veux qu'elle reparte) : décoche `discord_notified` sur cette bannière dans l'admin.

## 6️⃣ Si rien n'arrive sur Discord

Regarde les logs de PocketBase (`console.log` du hook) — le hook n'échoue jamais silencieusement en dehors de ces logs, mais il ne bloque jamais non plus la création du morceau/bannière si Discord ne répond pas. Causes courantes :
- Une variable d'environnement manquante ou mal nommée.
- Le bot n'a pas la permission d'écrire dans le salon visé.
- Token invalide/régénéré depuis (à mettre à jour dans l'environnement du serveur).
