# 📢 Configuration de la bannière d'annonce (collection `app_banners`)

La bannière en haut de la page d'accueil est entièrement pilotée depuis PocketBase.
Tu peux l'activer/désactiver, changer sa couleur, son texte et ses boutons **sans redéployer l'app** — les changements prennent effet au prochain chargement de la page d'accueil.

---

## 1️⃣ Créer la collection

Dans l'admin PocketBase (**http://188.115.125.74:8090/_/**) :
**Collections** → **Nouvelle collection** → Nom : `app_banners` → Type : **Base**

### Champs à créer

| Nom | Type | Requis | Détails |
|-----|------|--------|---------|
| active | Booléen | ❌ | ✅ coché = la bannière s'affiche, décoché = invisible |
| title | Texte | ❌ | Titre en gras (ex : "Maintenance en cours") |
| message | Texte | ❌ | Texte sous le titre |
| color | Sélection | ❌ | **Valeurs (une par ligne)** : `info`, `success`, `warning`, `error`, `primary` — Max select : 1 |
| dismissible | Booléen | ❌ | ✅ coché = l'utilisateur peut fermer la bannière avec un ✕ |
| button1_label | Texte | ❌ | Texte du 1er bouton (vide = pas de bouton) |
| button1_url | Texte | ❌ | Lien du 1er bouton |
| button2_label | Texte | ❌ | Texte du 2e bouton (vide = pas de 2e bouton) |
| button2_url | Texte | ❌ | Lien du 2e bouton |

### Règles d'accès (onglet "Règles")

- **List rule** : `""` (vide = public, l'app doit pouvoir lire la bannière)
- **View rule** : `""` (vide)
- **Create / Update / Delete** : laisser **verrouillé (admin uniquement)** — ⚠️ ne PAS mettre vide, sinon n'importe qui pourrait modifier la bannière !

---

## 2️⃣ Comment ça marche

- L'app charge **la bannière active la plus récemment modifiée** (`active = true`, triée par date de modification).
- Tu peux donc créer plusieurs bannières et n'activer que celle que tu veux.
- **Pas de bannière active = rien ne s'affiche** (aucune erreur, la section disparaît).
- Si la collection n'existe pas encore, l'app l'ignore silencieusement.

### Les couleurs

| Valeur | Apparence | Usage typique |
|--------|-----------|---------------|
| `info` | Bleu | Information neutre, nouveauté |
| `success` | Vert | Bonne nouvelle, mise à jour réussie |
| `warning` | Ambre/jaune | Maintenance, avertissement |
| `error` | Rouge | Panne, problème en cours |
| `primary` | Orange Jux (couleur de l'app) | Annonce mise en avant, événement |

### Les boutons (0, 1 ou 2)

- **Laisse `button1_label` vide** → aucun bouton.
- **Remplis `button1_label` + `button1_url`** → un bouton principal (fond coloré).
- **Remplis aussi `button2_label` + `button2_url`** → un 2e bouton secondaire (texte souligné).
- **URL interne** : commence par `/` → navigation dans l'app (ex : `/wrapped`, `/upload`, `/playlists`).
- **URL externe** : commence par `https://` → s'ouvre dans un nouvel onglet.

### Le bouton fermer (`dismissible`)

- Coché : l'utilisateur peut fermer la bannière, et elle reste cachée **pour lui** (stocké sur son appareil).
- Si tu **modifies la bannière** (n'importe quel champ), elle réapparaît pour tout le monde, même ceux qui l'avaient fermée.
- Décoché : pas de ✕, la bannière reste tant qu'elle est active.

---

## 3️⃣ Exemples de configuration

### Maintenance (l'ancienne bannière codée en dur)
| Champ | Valeur |
|-------|--------|
| active | ✅ |
| title | `Maintenance en cours` |
| message | `Seules les fonctionnalités principales sont disponibles. Le site est mis à jour en continu.` |
| color | `warning` |
| dismissible | ❌ |
| boutons | (vides) |

### Annonce d'une nouveauté avec 2 boutons
| Champ | Valeur |
|-------|--------|
| active | ✅ |
| title | `Ton Wrapped est arrivé ! 🎉` |
| message | `Découvre tes statistiques d'écoute de l'année.` |
| color | `primary` |
| dismissible | ✅ |
| button1_label | `Voir mon Wrapped` |
| button1_url | `/wrapped` |
| button2_label | `Plus tard` |
| button2_url | (vide — un bouton sans URL ne fait rien, mets plutôt dismissible ✅) |

### Panne signalée
| Champ | Valeur |
|-------|--------|
| active | ✅ |
| title | `Problème de lecture en cours` |
| message | `Certains titres peuvent ne pas se charger. On répare au plus vite.` |
| color | `error` |
| dismissible | ❌ |

---

## 4️⃣ Pour désactiver la bannière

Ouvre l'enregistrement dans PocketBase → décoche **active** → Enregistrer. C'est tout.
