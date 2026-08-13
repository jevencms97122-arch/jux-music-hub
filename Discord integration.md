# Badge Discord — rejoindre le serveur, débloquer un pseudo animé

## Contexte

Le profil a déjà un badge "PDG" (texte admin-only sur `profiles.badge`) qui colore le pseudo en doré animé (`.text-pdg-gold` dans `src/index.css`) et affiche une pastille via `ProfileBadge`. L'objectif est un mécanisme équivalent, mais auto-débloqué : rejoindre le serveur Discord officiel de Nexora-Music (`https://discord.gg/pRj8s8c4BB`, guild id `1509022526439952384`) débloque une pastille "Discord" + une animation de pseudo aux couleurs Discord (blurple), avec un toggle dans les Paramètres (activé par défaut une fois débloqué, visible mais verrouillé + expliqué tant que non débloqué).

Il n'existe aujourd'hui **aucune intégration Discord API/OAuth** dans le repo (seul le Rich Presence local vers l'appli Discord de l'utilisateur existe, côté `src-tauri/src/discord.rs`). Il faut donc bâtir la vérification d'appartenance au serveur de zéro, en réutilisant le seul mécanisme backend existant : un hook JS PocketBase (`pb_hooks/song_share.pb.js` sert de modèle exact de style/API).

**Vérification retenue : OAuth2 Discord, scope `identify guilds`** (pas de bot à héberger). Le flux :
1. Le front demande au backend un lien d'autorisation signé (état anti-CSRF).
2. L'utilisateur autorise sur Discord.
3. Discord redirige **directement vers le backend PocketBase** (`http://188.115.125.74:8090/api/discord/callback`, cf. `PB_URL` dans `song_share.pb.js`) — pas besoin que le frontend soit joignable publiquement.
4. Le hook échange le code, liste les guildes de l'utilisateur, vérifie la présence de la guild Nexora-Music, met à jour `profiles`, renvoie une page HTML de confirmation.
5. Le frontend rafraîchit le profil au retour sur focus de la fenêtre/app.

## Étapes préalables côté utilisateur (à faire avant de reprendre, pas du code)

1. **Créer une Discord Application** sur https://discord.com/developers/applications → OAuth2 → noter `Client ID` et `Client Secret`.
2. Dans OAuth2 → Redirects, ajouter exactement : `http://188.115.125.74:8090/api/discord/callback` (adapter si le `PB_URL` de prod diffère de celui vu dans `song_share.pb.js`).
3. Dans PocketBase Admin UI, sur la collection `profiles`, ajouter 3 champs :
   - `discord_id` (text, nullable)
   - `discord_verified` (bool, default false)
   - `discord_badge_enabled` (bool, default true)
4. Une fois le code en place, donner le Client ID/Secret pour les coller dans le hook (constantes en haut de fichier, comme `PB_URL`/`APP_URL` dans `song_share.pb.js`) — ou les mettre en placeholders et les remplacer directement sur le serveur.

## Backend — nouveau hook `pb_hooks/discord_oauth.pb.js`

Même style que `song_share.pb.js` (`routerAdd`, `$app.dao()`, constantes de config en tête de fichier). Pas de nouvelle collection PocketBase : l'état anti-CSRF est un token signé HMAC (`$security.hs256`), pas stocké en base.

- Constantes en tête : `PB_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID = "1509022526439952384"`, `STATE_SECRET` (chaîne aléatoire à générer).
- `GET /api/discord/start` (protégée par `$apis.requireRecordAuth()`) : construit `state = base64(profileId:timestamp) + "." + hs256(...)`, renvoie `{ authorizeUrl }` pointant vers `https://discord.com/api/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&scope=identify%20guilds&state=...`.
- `GET /api/discord/callback` : vérifie la signature + expiration (10 min) du `state`, échange `code` via `$http.send` vers `https://discord.com/api/oauth2/token`, appelle `GET https://discord.com/api/users/@me/guilds` avec le token obtenu, vérifie que `DISCORD_GUILD_ID` est présent, retrouve le profil par `user_id` (extrait du `state`), met à jour `discord_id`, `discord_verified = true`, et `discord_badge_enabled = true` **seulement si le champ n'était pas déjà défini** (ne pas écraser un choix utilisateur existant). Répond avec une page HTML minimale ("✅ Compte Discord vérifié, tu peux revenir sur Nexora Music" / message d'erreur sinon).

## Frontend

**Types** (`src/types/music.ts`) : ajouter `discord_id: string | null`, `discord_verified: boolean`, `discord_badge_enabled: boolean` à `Profile`.

**Mapping PocketBase → Profile** (3 endroits à mettre à jour à l'identique) :
- `src/contexts/AuthContext.tsx:80` (`recordToProfile`)
- `src/pages/UserProfile.tsx:61` (objet inline dans `setProfile`)
- `src/pages/Search.tsx:17-25` + `:90` (interface locale `UserResult`, plus légère — juste `discord_verified`/`discord_badge_enabled` à ajouter, pas `discord_id`)

**`updateProfile`** (`src/contexts/AuthContext.tsx:195`) : ajouter la prise en charge de `discord_badge_enabled` dans le `FormData` (même pattern que les champs existants), pour permettre au toggle des Paramètres de persister côté serveur (contrairement aux autres réglages de `SettingsSheet` qui sont en `localStorage`, celui-ci doit être visible par les autres utilisateurs donc stocké sur le profil).

**CSS** (`src/index.css`, juste après `.text-pdg-gold` ~ligne 1062) : nouvelle classe `.text-discord-blurple` + `@keyframes discord-shimmer`, même mécanique que le doré (`background-clip: text` animé), dégradé aux couleurs Discord (`#5865F2` blurple → `#7289DA` → `#EB459E` fuchsia ou variante plus sobre selon rendu).

**Icône Discord** : créer `src/components/icons/DiscordIcon.tsx` (SVG inline du logo Discord officiel — lucide-react n'a pas d'icônes de marques), props `className` pour s'intégrer comme les icônes lucide existantes.

**Nouveau composant `src/components/DiscordLinkSheet.tsx`** (calqué sur `DonationSheet.tsx`) :
- Bouton "Rejoindre le serveur" → `window.open('https://discord.gg/pRj8s8c4BB', '_blank')`.
- Bouton "Vérifier mon appartenance" → appelle `GET {PB_URL}/api/discord/start` (avec le token d'auth PocketBase), puis `window.location.href = authorizeUrl` (ou nouvel onglet).
- Si `profile.discord_verified` : affiche un état "✓ Compte Discord lié" au lieu des boutons.
- Au retour de focus sur la fenêtre après avoir lancé la vérification, appelle `refreshUser()` (déjà exposé par `useAuth()`) pour récupérer le nouveau statut sans reload manuel.

**`src/pages/ProfilePage.tsx`** :
- Insérer le trigger `DiscordLinkSheet` juste après `AppInfoSheet` (ligne 566) et avant `DonationSheet` (ligne 567), même style de bouton que les deux (icône + libellé + chevron).
- Ligne 259 (`h2` pseudo) : étendre le `cn(...)` existant — priorité au doré PDG, sinon `.text-discord-blurple` si `profile?.discord_verified && profile?.discord_badge_enabled`.
- Ligne 264 : à côté de `<ProfileBadge>`, afficher une pastille Discord (petit composant inline, style similaire mais bleu Discord + `DiscordIcon`) quand débloqué + activé.

**`src/pages/UserProfile.tsx`** : même double ajout (animation pseudo + pastille) aux emplacements identifiés (lignes ~189/215), pour que le badge soit visible par les autres utilisateurs visitant le profil.

**`src/pages/Search.tsx:276`** : étendre le `cn(...)` du pseudo pour inclure l'animation Discord (pas de pastille ici, comme pour PDG aujourd'hui).

**`src/components/SettingsSheet.tsx`** :
- `const { logout, profile, updateProfile } = useAuth();` (ligne 35).
- Nouveau bloc toggle après celui de l'Assistant vocal (~ligne 275), même structure exacte que le bloc `isSpeechRecognitionSupported()` (lignes 236-257) :
  - `Switch checked={profile?.discord_badge_enabled ?? true} disabled={!profile?.discord_verified} onCheckedChange={(v) => updateProfile({ discord_badge_enabled: v })}`
  - Si `!profile?.discord_verified`, message verrouillé sous le switch (même style `text-amber-400`) : "Rejoins le serveur Discord depuis ton profil pour débloquer ce badge."

## Vérification (une fois implémenté)

- `npx tsc --noEmit -p tsconfig.json` doit passer sans erreur après chaque étape de code.
- Test manuel en dev (`npm run dev`) : bouton "Rejoindre le serveur Discord" sur `/profile` → ouvre l'invite Discord dans un nouvel onglet, "Vérifier" redirige vers Discord OAuth, callback backend répond une page de succès, retour sur l'app → pseudo animé + pastille visibles sans reload (grâce au `refreshUser()` sur focus).
- Vérifier dans les Paramètres que le toggle est bien grisé + message d'explication tant que non vérifié, puis activable une fois débloqué.
- Vérifier qu'un utilisateur PDG garde la priorité au doré (pas de conflit visuel si les deux badges sont vrais en même temps).
