# SFX — Nouveau message

Dépose ici tes fichiers son (`.mp3`, `.wav`, `.ogg`) pour les notifications de nouveau message.

Contrairement à avant, ces fichiers ne sont plus auto-détectés au build (un pattern
`import.meta.glob` faisait planter `vite-plugin-pwa` de façon aléatoire sous Windows).
Après avoir ajouté un fichier ici, ajoute aussi son nom dans le tableau `FILENAMES` de
`src/lib/notificationSfx.ts`.
