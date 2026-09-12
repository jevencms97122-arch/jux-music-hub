# 📊 Compteurs "écoutes" / "vues" sur les playlists

Remplace le compteur de likes affiché sur les cartes de playlist par deux
compteurs : nombre de **personnes distinctes** ayant lancé la lecture, et
nombre de **personnes distinctes** ayant consulté la playlist.

Les champs `view_count` et `play_count` de la collection `playlists`
**existent déjà** dans ton schéma (ils étaient chargés partout dans le code
mais jamais réellement incrémentés) — rien à ajouter là-dessus. Ce qu'il
manque, ce sont les deux tables qui garantissent qu'on compte des **personnes
uniques** et pas des relectures répétées par la même personne.

---

## 1️⃣ Créer la collection `playlist_views`

**Collections → Nouvelle collection → Base**, nom `playlist_views`.

| Champ | Type | Requis |
|---|---|---|
| `playlist_id` | Relation → `playlists` | ✅ |
| `user_id` | Relation → `users` (ou ta collection d'utilisateurs) | ✅ |

**Onglet Index** → ajoute un index **unique** sur `(playlist_id, user_id)` :
```sql
CREATE UNIQUE INDEX idx_playlist_views_unique ON playlist_views (playlist_id, user_id)
```
C'est cet index qui empêche une même personne d'être comptée deux fois — la
deuxième tentative de création échoue, l'app l'attrape et n'incrémente rien.

**Règles d'API** :
- Create : `@request.auth.id != "" && @request.auth.id = user_id` (chacun ne peut créer qu'une vue en son propre nom)
- List/View : `""` (vide, public — nécessaire pour afficher les compteurs)
- Update/Delete : verrouillé (personne, ces lignes ne changent jamais)

## 2️⃣ Créer la collection `playlist_plays`

Exactement la même chose, dupliquée sous le nom `playlist_plays` :

| Champ | Type | Requis |
|---|---|---|
| `playlist_id` | Relation → `playlists` | ✅ |
| `user_id` | Relation → `users` | ✅ |

Index unique sur `(playlist_id, user_id)`, mêmes règles d'API que ci-dessus.

## 3️⃣ Déposer le hook `playlist_engagement.pb.js`

Aucune règle à changer sur `playlists` — surtout **ne pas** élargir sa règle
Update pour ça : un visiteur qui écoute la playlist publique de quelqu'un
d'autre n'a pas le droit de la modifier, et c'est très bien ainsi (sinon
n'importe qui pourrait réécrire le titre/la description d'une playlist qui
n'est pas la sienne).

C'est pour ça que l'incrément de `view_count`/`play_count` se fait **côté
serveur**, via `pb_hooks/playlist_engagement.pb.js` : il réagit à la création
d'une ligne dans `playlist_views`/`playlist_plays` et met à jour `playlists`
avec les pleins droits de l'application, sans passer par la règle Update.

Copie ce fichier sur ton serveur au même endroit que `discord_notify.pb.js`
(voir DISCORD_NOTIFY_SETUP.md pour l'emplacement exact chez toi) — pas de
variable d'environnement à configurer pour celui-ci.

## 4️⃣ Comment ça se déclenche côté app

- **Vue** : à l'ouverture de la page d'une playlist (une fois par personne, pour toujours — revisiter la même playlist ne recompte pas).
- **Écoute** : au clic sur le bouton "Lecture" en haut de la page playlist (pas en cliquant sur un titre individuel dans la liste).
