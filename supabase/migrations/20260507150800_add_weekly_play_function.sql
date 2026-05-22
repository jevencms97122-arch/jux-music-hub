-- Fonction qui incrémente seulement le weekly_play_count (appelée après 30s d'écoute)
CREATE OR REPLACE FUNCTION public.increment_song_weekly_play(_song_id uuid)
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
  SET weekly_play_count = COALESCE(weekly_play_count, 0) + 1,
      updated_at = now()
  WHERE id = _song_id
  RETURNING weekly_play_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_song_weekly_play(uuid) TO authenticated;

-- Restaurer increment_song_play pour n'incrémenter QUE play_count
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
      updated_at = now()
  WHERE id = _song_id
  RETURNING play_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_song_play(uuid) TO authenticated;