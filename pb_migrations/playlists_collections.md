# Collections PocketBase pour le système de Playlists

## Collection: playlists

Cette collection stocke toutes les playlists créées par les utilisateurs.

### Champs:

| Nom du champ | Type | Requis | Description |
|--------------|------|--------|-------------|
| title | Plain text | Oui | Titre de la playlist (max 255 caractères) |
| description | Plain text | Non | Description de la playlist (max 500 caractères) |
| public | Bool | Oui | Si la playlist est publique ou privée (défaut: true) |
| owner | Relation | Oui | Référence vers la collection users |
| songs | Relation | Non | Référence multiple vers la collection songs |
| viewCount | Number | Non | Nombre de vues (défaut: 0) |
| playCount | Number | Non | Nombre de lectures (défaut: 0) |
| likesCount | Number | Non | Nombre de likes/enregistrements (défaut: 0) |
| thumbnailMode | Select | Non | Mode d'affichage: "grid" ou "single" (défaut: "grid") |

### Règles de sécurité (API Rules):

- **List/Search**: `public = true || owner.id = @request.auth.id`
- **View**: `public = true || owner.id = @request.auth.id`
- **Create**: `@request.auth.id != ""`
- **Update**: `owner.id = @request.auth.id`
- **Delete**: `owner.id = @request.auth.id`

---

## Collection: playlist_likes

Cette collection gère le système d'enregistrement/sauvegarde des playlists par les utilisateurs.

### Champs:

| Nom du champ | Type | Requis | Description |
|--------------|------|--------|-------------|
| user | Relation | Oui | Référence vers la collection users |
| playlist | Relation | Oui | Référence vers la collection playlists |

### Règles de sécurité (API Rules):

- **List/Search**: `user.id = @request.auth.id || playlist.public = true`
- **View**: `user.id = @request.auth.id || playlist.public = true`
- **Create**: `@request.auth.id != ""`
- **Update**: `user.id = @request.auth.id`
- **Delete**: `user.id = @request.auth.id`

---

## Collection: song_likes (existante - modifications)

Cette collection existe déjà mais doit être utilisée différemment:
- Le like d'un morceau incrémente le compteur `likesCount` du morceau
- Le morceau est automatiquement ajouté à la playlist "Titres likés" de l'utilisateur

---

## Index recommandés:

### playlists:
- `owner` (pour récupérer les playlists d'un utilisateur)
- `public` (pour filtrer les playlists publiques)
- `created` (pour le tri par date)
- `viewCount` (pour le classement par popularité)
- `playCount` (pour le classement par lectures)
- `likesCount` (pour le classement par likes)

### playlist_likes:
- `user` (pour récupérer les playlists likées par un utilisateur)
- `playlist` (pour compter les likes d'une playlist)
- Composite: `user + playlist` (unicité)

---

## Notes importantes:

1. **Playlist "Titres likés"**: Cette playlist spéciale est créée automatiquement pour chaque utilisateur lors de son premier like. Elle ne peut pas être supprimée.

2. **Compteurs**: Les compteurs `viewCount`, `playCount`, et `likesCount` doivent être incrémentés côté serveur pour éviter les conditions de course.

3. **Thumbnails**: Le mode "grid" affiche une grille de 4 miniatures des morceaux. Le mode "single" affiche uniquement la miniature du premier morceau.

4. **Cascade de suppression**: Lorsqu'une playlist est supprimée, les entrées correspondantes dans `playlist_likes` doivent être supprimées.