# 📋 Guide complet de configuration PocketBase pour Jux Music

## 1️⃣ Accéder à l'interface admin PocketBase

Ouvre dans ton navigateur : **http://188.115.125.74:8090/_/**

Connecte-toi avec :
- **Email** : `julo.even97122@gmail.com`
- **Mot de passe** : `D4RZCMVZPHQ3`

*(Si ça ne marche pas, clique sur "Mot de passe oublié" ou vérifie que le serveur PocketBase est bien lancé)*

---

## 2️⃣ Collections à créer (18 collections)

Pour chaque collection, clique sur **"Collections"** dans le menu de gauche, puis **"Nouvelle collection"**.

⚠️ **Règles d'accès importantes** : Pour chaque collection, dans l'onglet "Règles", mets **TOUS les champs à `""` (vide)** = accès public. Sinon l'API bloquera les requêtes.

---

### Collection 1 : `users` (déjà créée automatiquement par PocketBase)

PocketBase crée automatiquement la collection `users` pour l'authentification. Tu n'as rien à faire.

---

### Collection 2 : `profiles`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| user_id | Texte | ✅ |
| pseudo | Texte | ❌ |
| first_name | Texte | ❌ |
| last_name | Texte | ❌ |
| avatar | Fichier | ❌ (max 5MB) |
| bio | Texte | ❌ |
| profile_completed | Booléen | ❌ |

---

### Collection 3 : `songs`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| title | Texte | ✅ |
| author | Texte | ✅ |
| audio_url | Texte | ❌ |
| cover_url | Texte | ❌ |
| video_url | Texte | ❌ |
| genre | Texte | ❌ |
| uploaded_by | Texte | ✅ |
| duration | Nombre | ❌ |
| play_count | Nombre | ❌ |
| weekly_play_count | Nombre | ❌ |
| likes_count | Nombre | ❌ |
| weekly_reset_at | Texte | ❌ |
| youtube_id | Texte | ❌ |

---

### Collection 4 : `playlists`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| title | Texte | ✅ |
| description | Texte | ❌ |
| is_public | Booléen | ❌ |
| owner_id | Texte | ✅ |
| view_count | Nombre | ❌ |
| play_count | Nombre | ❌ |
| likes_count | Nombre | ❌ |
| thumbnail_mode | Texte | ❌ |

---

### Collection 5 : `playlist_songs`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| playlist_id | Texte | ✅ |
| song_id | Texte | ✅ |
| added_by | Texte | ✅ |
| position | Nombre | ❌ |

---

### Collection 6 : `playlist_collaborators`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| playlist_id | Texte | ✅ |
| user_id | Texte | ✅ |
| role | Texte | ❌ |

---

### Collection 7 : `playlist_likes`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| playlist_id | Texte | ✅ |
| user_id | Texte | ✅ |

---

### Collection 8 : `song_likes`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| song_id | Texte | ✅ |
| user_id | Texte | ✅ |

---

### Collection 9 : `song_comments`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| song_id | Texte | ✅ |
| user_id | Texte | ✅ |
| content | Texte | ✅ |

---

### Collection 10 : `listen_history`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| user_id | Texte | ✅ |
| song_id | Texte | ✅ |
| listened_at | Texte | ❌ |

---

### Collection 11 : `user_stats`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| user_id | Texte | ✅ |
| current_streak | Nombre | ❌ |
| longest_streak | Nombre | ❌ |
| total_listens | Nombre | ❌ |
| last_listen_date | Texte | ❌ |

---

### Collection 12 : `notifications`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| recipient_id | Texte | ✅ |
| type | Texte | ✅ |
| title | Texte | ✅ |
| body | Texte | ❌ |
| data | JSON | ❌ |
| is_read | Booléen | ❌ |

---

### Collection 13 : `stories`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| user_id | Texte | ✅ |
| song_id | Texte | ✅ |
| start_time | Nombre | ❌ |
| end_time | Nombre | ❌ |
| comment | Texte | ❌ |
| expires_at | Texte | ❌ |

---

### Collection 14 : `story_views`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| story_id | Texte | ✅ |
| viewer_id | Texte | ✅ |

---

### Collection 15 : `user_presence`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| user_id | Texte | ✅ |
| is_listening | Booléen | ❌ |
| current_song_id | Texte | ❌ |
| current_song_title | Texte | ❌ |
| current_song_author | Texte | ❌ |
| current_song_cover_url | Texte | ❌ |
| last_seen_at | Texte | ❌ |

---

### Collection 16 : `follows`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| follower_id | Texte | ✅ |
| following_id | Texte | ✅ |
| status | Texte | ❌ |

---

### Collection 17 : `listen_sessions`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| host_id | Texte | ✅ |
| song_id | Texte | ❌ |
| current_time_seconds | Nombre | ❌ |
| is_playing | Booléen | ❌ |
| is_active | Booléen | ❌ |
| participants | JSON | ❌ |
| ready_participants | JSON | ❌ |
| code | Texte | ❌ |

---

### Collection 18 : `app_versions`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| last_version | Nombre | ✅ |
| description | Texte | ❌ |

---

### Collection 19 : `artists`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| name | Texte | ✅ |
| cover | Fichier | ❌ (max 5MB) |

---

### Collection 20 : `media`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis |
|-----|------|--------|
| kind | Texte | ❌ |
| owner_id | Texte | ❌ |
| file | Fichier | ❌ (max 50MB) |

---

## 3️⃣ Règles d'accès (TRÈS IMPORTANT)

Pour **CHAQUE collection** que tu crées, va dans l'onglet **"Règles"** et mets :

| Règle | Valeur |
|-------|--------|
| listRule | `""` (vide) |
| viewRule | `""` (vide) |
| createRule | `""` (vide) |
| updateRule | `""` (vide) |
| deleteRule | `""` (vide) |

👉 Sinon les requêtes échoueront avec une erreur 403.

---

## 4️⃣ 🔐 Configuration de l'AUTHENTIFICATION (TRÈS IMPORTANT)

L'application utilise maintenant **l'authentification native PocketBase** au lieu de Supabase Auth.  
Les utilisateurs se connectent via la collection `users` de PocketBase.

### Étapes dans l'admin PocketBase :

1. Va dans **Settings ⚙️ → Auth → Email/Password**
2. Active la méthode : ✅ **Email/Password**
3. Coche : ✅ **"Allow record authentication"**
4. **Désactive** (décoche) : ❌ **"Verification required"** (pour que les nouveaux utilisateurs puissent s'inscrire sans confirmation par email)
5. Clique sur **"Save"**

### La collection `users` (collection système automatique)

PocketBase crée automatiquement la collection **`users`** avec les champs :
- `id` - auto-généré
- `email` - utilisé pour la connexion
- `password` - hashé automatiquement
- `verified` - statut de vérification
- ... autres champs système

**Tu n'as pas besoin de créer manuellement la collection `users`** - PocketBase le fait tout seul.

### Comment l'app utilise l'auth maintenant :

```typescript
// Connexion
await pb.collection('users').authWithPassword(email, password);

// Inscription
await pb.collection('users').create({ email, password, passwordConfirm: password });

// Déconnexion
pb.authStore.clear();

// Vérifier si connecté
pb.authStore.isValid
pb.authStore.model // utilisateur connecté
```

### ⚠️ Règles pour la collection `users`
La collection `users` doit aussi avoir ses règles d'accès :
- **listRule** : laisser vide ou `""`  
- **viewRule** : `""`
- **createRule** : `""` (important pour l'inscription)
- **updateRule** : `""`
- **deleteRule** : `""`

Va dans **Collections → users → Règles** et vérifie que tout est vide `""`.

---

## 5️⃣ Redémarrer le serveur PocketBase

Après avoir créé toutes les collections, redémarre PocketBase :
- Arrête le processus
- `./pocketbase serve --http=0.0.0.0:8090`

---

## ✅ Vérification rapide

Teste que tout fonctionne :

```bash
curl http://188.115.125.74:8090/api/health
# Doit retourner: {"message":"API is healthy.","code":200,"data":{}}
```

```bash
curl http://188.115.125.74:8090/api/collections
# Doit retourner la liste de toutes les collections (si token admin valide)
```

---

## 📝 Note sur les 8 pages restantes

Quand tu auras fini de créer les collections, je pourrai continuer à migrer les pages suivantes :
- pages/CarMode.tsx
- pages/ListenTogether.tsx
- pages/Social.tsx
- pages/UserProfile.tsx
- pages/ProfileEdit.tsx
- pages/ProfileSetup.tsx
- pages/Wrapped.tsx

Dis-moi "continue" quand les collections sont créées !