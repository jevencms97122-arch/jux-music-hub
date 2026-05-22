-- Ajouter la colonne video_url à la table songs pour les liens YouTube
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS video_url TEXT;