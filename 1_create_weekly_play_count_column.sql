-- ====== 1. EXÉCUTE CE FICHIER EN PREMIER ======
-- Ajout de la colonne weekly_play_count pour le classement des tendances
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS weekly_play_count INTEGER NOT NULL DEFAULT 0;

-- Création d'un index pour les performances du classement
CREATE INDEX IF NOT EXISTS idx_songs_weekly_play_count ON public.songs(weekly_play_count DESC);