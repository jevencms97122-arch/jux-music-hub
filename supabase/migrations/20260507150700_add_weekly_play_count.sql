-- Ajout de la colonne weekly_play_count pour le classement des tendances
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS weekly_play_count INTEGER NOT NULL DEFAULT 0;

-- Création d'un index pour les performances du classement
CREATE INDEX IF NOT EXISTS idx_songs_weekly_play_count ON public.songs(weekly_play_count DESC);

-- Nouvelle fonction qui incrémente play_count + weekly_play_count
CREATE OR REPLACE FUNCTION public.increment_song_play(_song_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.songs
  SET play_count = COALESCE(play_count, 0) + 1,
      weekly_play_count = COALESCE(weekly_play_count, 0) + 1,
      updated_at = now()
  WHERE id = _song_id
  RETURNING weekly_play_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_song_play(uuid) TO authenticated;