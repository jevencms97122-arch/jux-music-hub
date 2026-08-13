---
name: créer-app
description: Compile Nexora Music (Windows et/ou Android) — bump de version synchronisé sur les trois fichiers, build signé, et remise du .sig (Windows) / vérification de signature (Android). Utiliser quand l'utilisateur tape /créer-app, ou demande de "compiler l'app" / "compiler une nouvelle version" pour une ou plusieurs plateformes.
---

# Créer une nouvelle version de l'app

Reproduit le processus de build suivi tout au long du développement de Nexora Music : bump de version synchronisé, build signé pour Windows et/ou Android, et remise des artefacts (exe + `.sig`, ou APK vérifié).

## 1. Déterminer la ou les plateformes

Si l'utilisateur a précisé la/les plateforme(s) dans sa demande (ex: "compile pour Windows", "/créer-app android"), utiliser celles-ci directement.

**Sinon, demander avec `AskUserQuestion`** (ne jamais deviner) :
- Question : "Pour quelle(s) plateforme(s) veux-tu compiler ?"
- Options : Windows, Android, Les deux (multiSelect ou une option combinée)

## 2. Déterminer le numéro de version

Lire la version actuelle dans `package.json`. Si l'utilisateur a donné un numéro de version explicite, l'utiliser. Sinon, **incrémenter le numéro de patch** (dernier chiffre) de 1 par défaut — c'est la convention suivie jusqu'ici (ex: 0.0.3 → 0.0.4).

**Un seul numéro de version pour toutes les plateformes** — mettre à jour les trois fichiers en synchronisation :
- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version = "..."` (section `[package]`)
- `src-tauri/tauri.conf.json` → `"version"`

## 3. Vérifications avant compilation (toujours, avant tout build natif)

Ces builds sont longs (1-3 min Windows, plus pour Android) — mieux vaut attraper les erreurs avant de les lancer :

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Si `npm run build` échoue avec une erreur `Cannot find package` / module introuvable, `node_modules` est probablement désynchronisé (ex: après un pull ou un changement de branche) — lancer `npm install` puis réessayer `npm run build`.

Si les deux passent sans erreur, continuer. Sinon, corriger les erreurs avant de lancer un build natif.

## 4. Build Windows

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/updater-private.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="JuxUpdater2026!"
npm run tauri:build
```

Lancer en arrière-plan (`run_in_background: true`), c'est long (~1-3 min).

**Artefacts produits** :
- `src-tauri/target/release/bundle/nsis/Nexora Music_<version>_x64-setup.exe` (celui à donner à l'utilisateur — pas le `.msi`)
- `src-tauri/target/release/bundle/nsis/Nexora Music_<version>_x64-setup.exe.sig`

**Une fois le build terminé** : afficher le contenu du `.sig` directement dans la réponse (`cat` le fichier) — c'est ce que l'utilisateur colle dans le champ `signature` de PocketBase (collection `app_updates`, backend updater port 8091). Donner aussi le chemin de l'exe.

## 5. Build Android

```bash
npx tauri android build --apk
```

Lancer en arrière-plan, c'est plus long que Windows (peut dépasser 5-10 min selon l'état du cache Gradle/Cargo).

Signature déjà configurée via `src-tauri/gen/android/app/keystore.properties` — aucune étape de signature manuelle nécessaire, `tauri android build --apk` produit directement un APK signé release.

**Artefact produit** :
- `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`

**Une fois le build terminé**, vérifier la signature avant de la donner comme "prête" :

```bash
"/c/Users/jeven/AppData/Local/Android/Sdk/build-tools/36.0.0/apksigner.bat" verify "/c/Users/jeven/Documents/Nexora-Music/jux-music-hub/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk"
```

(adapter le numéro de version de build-tools si celui-ci n'existe plus — lister `Sdk/build-tools/` pour trouver la version installée). Confirmer `Verifies` / exit code 0, donner le chemin et la taille du fichier.

## 6. Si les deux plateformes sont demandées

**Ne jamais lancer les deux builds en parallèle** — les deux utilisent `npm run build` (frontend) comme étape préalable et écrivent dans le même dossier `dist/`, ce qui peut créer une course/corruption. Lancer Windows d'abord, attendre sa fin, puis lancer Android (ou l'inverse) — jamais simultanément.

## 7. À la fin

Résumer clairement pour chaque plateforme compilée :
- Chemin du fichier
- Pour Windows : contenu du `.sig` affiché en clair
- Pour Android : confirmation de vérification de signature + taille du fichier
- Rappeler le numéro de version utilisé
