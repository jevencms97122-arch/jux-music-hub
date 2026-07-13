# 💬 Collection `messages` — Chat entre amis

Collection PocketBase pour la messagerie (texte, vocaux, partages de musique).

## Collection : `messages`
- **Type** : Base
- **Champs** :

| Nom | Type | Requis | Notes |
|-----|------|--------|-------|
| sender_id | Texte | ✅ | id de l'utilisateur qui envoie |
| recipient_id | Texte | ✅ | id du destinataire |
| type | Select | ✅ | valeurs : `text`, `voice`, `song_share` |
| text | Texte | ❌ | contenu du message texte / message optionnel du partage |
| voice | Fichier | ❌ | message vocal (audio, max 15MB) |
| voice_duration | Nombre | ❌ | durée du vocal en secondes |
| song_id | Texte | ❌ | id du titre partagé (type song_share) |
| clip_start | Nombre | ❌ | début de l'extrait (secondes) |
| clip_end | Nombre | ❌ | fin de l'extrait (secondes) |
| is_read | Booléen | ❌ | lu / non lu |

- **Règles d'accès** : tous les champs à `""` (vide) = accès public, comme les autres collections du projet.

## Utilisé par
- `src/hooks/useChat.ts` — envoi/réception, compteur de non-lus
- `src/pages/Chat.tsx` — page de conversation (/chat/:userId)
- `src/components/ChatSongCard.tsx` — widget musique partagée dans le chat
- `src/components/ShareToFriendSheet.tsx` — partage d'un titre avec extrait personnalisé
