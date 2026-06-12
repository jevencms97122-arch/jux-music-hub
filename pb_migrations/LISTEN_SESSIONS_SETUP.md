# Configuration de la collection `listen_sessions`

Collection **Base** nommée exactement `listen_sessions`.

## Champs à créer

| Champ | Type PocketBase | Options |
|---|---|---|
| `host_id` | Plain text | ✅ Nonempty (requis) |
| `code` | Plain text | — |
| `song_id` | Plain text | — |
| `position` | Number | — (secondes dans le titre en cours) |
| `tempo` | Number | — (vitesse de lecture, 1 = normal, 0.96 = 96 %) |
| `is_playing` | Bool | — |
| `is_active` | Bool | — |
| `participants` | JSON | — (tableau d'IDs utilisateurs) |

> ⚠️ Le champ s'appelle bien `position` (et plus `current_time_seconds`).
> Il n'y a **plus** de champ `ready_participants` — ne pas le recréer.

Les champs `created` / `updated` sont automatiques, rien à faire.

## API Rules (onglet "API rules")

Mettre la même règle sur **List/Search, View, Create, Update** :

```
@request.auth.id != ""
```

Pour **Delete** (optionnel, seul l'hôte peut supprimer) :

```
@request.auth.id != "" && host_id = @request.auth.id
```

## Comment ça marche côté code

- L'hôte lance un titre → écrit `{ song_id, position: 0, is_playing: true }`.
- Toutes les 3 s, l'hôte pousse `position` (jamais pendant un crossfade ni un chargement).
- **Toutes les écritures de l'hôte sont sérialisées** (file d'attente) : impossible qu'une
  vieille position arrive au serveur après un changement de titre.
- Les invités suivent en temps réel (subscribe) : ils chargent `song_id`, se calent sur
  `position`, et obéissent à `is_playing`. Ils ignorent toute position qui ne correspond
  pas au titre qu'ils ont réellement chargé.
- Le tempo de l'hôte est diffusé via `tempo` : quand l'hôte le change (ou lance un titre),
  tous les invités l'appliquent automatiquement. Les invités ne peuvent pas le modifier.
