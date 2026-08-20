# Sessions ouvertes / Session permanente — modifications backend

## 1. Collection `listen_sessions` : ajouter le champ `is_open`

Dans l'admin PocketBase, ouvrir la collection **`listen_sessions`** et ajouter :

| Champ | Type PocketBase | Options |
|---|---|---|
| `is_open` | Bool | — (défaut : faux = session privée) |

Les API rules existantes (`@request.auth.id != ""` sur List/View/Create/Update)
couvrent déjà ce champ, rien d'autre à changer.

## Comment ça marche côté code

Le réglage manuel "session ouverte/privée" par l'hôte a été retiré : les amis
rejoignent soit par code, soit via une invitation (notification cliquable qui
rejoint directement, sans ressaisir de code), soit via la **Session permanente**.

- **Session permanente** (Paramètres, toutes plateformes, désactivée par
  défaut) : dès que le titulaire écoute une musique en ligne sans être déjà
  dans une session, l'app crée automatiquement une session avec `is_open: true`.
  Le réglage lui-même est purement local (`localStorage`), seule l'existence
  d'une session `is_open = true` côté serveur signale l'activité aux abonnés.
- Ses abonnés (follows acceptés) la voient listée sur l'accueil, sous les
  tendances de la semaine, avec le titre en cours — un tap rejoint directement.
- Rejoindre = s'ajouter aux `participants` ; la mécanique de session existante
  (subscribe temps réel) charge alors automatiquement le titre en cours et cale
  l'invité sur la `position` de l'hôte, avec les mêmes règles qu'un participant
  non-admin dans une session classique.
- Si le champ `is_open` n'existe pas encore côté serveur, l'app dégrade
  proprement : aucune activité n'apparaît sur l'accueil, sans erreur visible.

## Notes sur les autres features du lot

- **"Ce que tes amis aiment"** (accueil) : s'appuie sur les collections
  existantes `follows`, `song_likes`, `songs`, `profiles` — aucune modification
  backend nécessaire (la collection `user_favorites` proposée ferait doublon
  avec `song_likes`).
- **Mode hors connexion** : entièrement local (IndexedDB + localStorage) — la
  collection `offline_library_sync` proposée est inutile côté serveur ; les
  écoutes hors ligne sont resynchronisées via `listen_history` et `play_count`
  à la reconnexion.
