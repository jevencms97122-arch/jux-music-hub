
# Plan — Stockage média externe (PocketBase / serveur HTTP)

Supabase reste la base de tout (DB, auth, tables). Seuls **les fichiers** (audio, covers, avatars) partent sur un serveur média externe configurable via variable d'env.

## Prérequis bloquant — HTTPS

Le site est servi en `https://` → les navigateurs bloquent tout `http://`. Tant que `188.115.125.74:8090` reste en HTTP, **rien ne marchera dans le navigateur** (audio muet, covers cassées). Sur les apps natives (Android/Windows) ça passe quand même.

À régler côté serveur avant que la migration soit utilisable sur le web :
- Cloudflare Tunnel (gratuit, 10 min) : `cloudflared tunnel --url http://localhost:8090` → URL HTTPS instantanée
- ou Caddy + nom de domaine → HTTPS auto via Let's Encrypt

Le code, lui, peut être écrit dès maintenant avec une variable d'env `VITE_MEDIA_BASE_URL` que tu changeras au moment voulu.

---

## Architecture cible

```text
┌─────────────────────────────┐         ┌──────────────────────────┐
│ Supabase                    │         │ Serveur média (PocketBase│
│ - auth                      │         │  ou n'importe quel HTTP) │
│ - tables (songs, likes…)    │         │                          │
│ - songs.audio_url ──────────┼────URL──┤  /api/files/media/<id>/  │
│ - songs.cover_url ──────────┼────URL──┤        <filename>        │
│ - profiles.avatar_url ──────┼────URL──┤                          │
└─────────────────────────────┘         └──────────────────────────┘
```

Les colonnes `audio_url`, `cover_url`, `avatar_url` stockent désormais **l'URL HTTPS complète** retournée par le serveur média (ex: `https://pb.tondomaine.com/api/files/media/abc123/song.mp3`).

`storage.ts` est rendu **rétro-compatible** : si la valeur commence par `http`, on l'utilise telle quelle ; sinon fallback Supabase Storage (transition douce, anciens fichiers continuent de marcher).

---

## Étapes

### 1. Côté serveur média (à faire par toi)
- Sur PocketBase, créer une collection `media` avec :
  - `kind` (text : `audio` / `cover` / `avatar`)
  - `owner_id` (text)
  - `file` (file, single)
  - `createRule` / `listRule` / `viewRule` = `""` (public, conforme à ton choix)
- Configurer CORS PocketBase pour autoriser :
  - `https://juxmusicfree.lovable.app`
  - `https://*.lovableproject.com`
- (Plus tard) mettre HTTPS devant.

### 2. Variables d'environnement
Ajouter dans `.env` :
```
VITE_MEDIA_BASE_URL=https://ton-pocketbase-https.com
VITE_MEDIA_COLLECTION=media
```
Tant que tu n'as pas l'URL HTTPS, on peut laisser vide → fallback automatique sur Supabase Storage.

### 3. Nouveau module `src/lib/mediaServer.ts`
- `uploadMedia(kind, file, userId): Promise<string>` → POST multipart vers `${BASE}/api/collections/media/records`, renvoie l'URL HTTPS finale du fichier.
- `deleteMedia(url): Promise<void>` → extrait `recordId` depuis l'URL, fait `DELETE`.
- `isExternalMediaUrl(url)` → helper.

### 4. Refactor `src/lib/storage.ts`
- `songCoverUrl` / `songAudioUrl` / `avatarUrl` : si la valeur commence par `http` → retourner telle quelle. Sinon → comportement Supabase actuel.
- Nouveau `uploadFileSmart(kind, userId, file)` : si `VITE_MEDIA_BASE_URL` défini → `uploadMedia(...)`, sinon → fallback `uploadFile` Supabase actuel. Renvoie une chaîne à mettre direct dans la DB (URL ou path).

### 5. Câblage des écrans d'upload
Remplacer les appels `uploadFile('songs'|'covers'|'avatars', ...)` par `uploadFileSmart(...)` dans :
- `src/pages/Upload.tsx` (audio + cover)
- `src/pages/ProfileEdit.tsx` (avatar)
- `src/components/CreateStoryModal.tsx` si applicable

### 6. Script de migration des anciens fichiers (à exécuter une fois)
Fichier `scripts/migrate-storage-to-media-server.mjs` (lancé en local, pas dans l'app) :
- Lit toutes les `songs` et `profiles` en DB
- Pour chaque `audio_url` / `cover_url` / `avatar_url` encore au format Supabase :
  1. Télécharge depuis Supabase Storage
  2. Upload vers le serveur média
  3. `UPDATE` la ligne avec la nouvelle URL
- Log + reprise sur erreur
- Optionnel `--delete-source` pour vider Supabase Storage après validation

### 7. `mediaCache.ts`
Étendre `isSupabaseStorageUrl()` → reconnaît aussi les URLs `VITE_MEDIA_BASE_URL` pour bénéficier du cache IndexedDB mobile.

### 8. Apps natives
**Aucun changement requis** : `downloadSong()` reçoit déjà les URLs depuis le web → elles pointeront simplement vers le serveur média.

---

## Risques

- **HTTPS obligatoire** : sans ça, web cassé (apps natives OK). Le code est prêt mais inutilisable web tant que ton serveur reste en HTTP.
- **CORS** : oublier la config PocketBase = uploads bloqués par le navigateur.
- **Bande passante serveur** : tout le streaming musical passera par chez toi. Cloudflare devant peut cacher et soulager.
- **Upload public** (ton choix) : n'importe qui avec l'URL peut uploader sur PocketBase → à durcir plus tard avec une edge function Supabase relais qui vérifie le JWT.

---

## Livrables

- `src/lib/mediaServer.ts` (nouveau)
- `src/lib/storage.ts` (refactor rétro-compatible)
- `src/lib/mediaCache.ts` (extension)
- `src/pages/Upload.tsx`, `src/pages/ProfileEdit.tsx` (+ CreateStoryModal si besoin)
- `scripts/migrate-storage-to-media-server.mjs`
- `.env` : ajout de `VITE_MEDIA_BASE_URL` et `VITE_MEDIA_COLLECTION`
- Mémoire projet mise à jour (le stockage média n'est plus Supabase)
