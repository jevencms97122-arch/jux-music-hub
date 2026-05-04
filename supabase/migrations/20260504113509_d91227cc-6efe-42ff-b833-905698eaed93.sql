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

CREATE OR REPLACE FUNCTION public.sync_song_likes_count(_song_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO new_count
  FROM public.song_likes
  WHERE song_id = _song_id;

  UPDATE public.songs
  SET likes_count = new_count,
      updated_at = now()
  WHERE id = _song_id;

  RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_song_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_song_likes_count(NEW.song_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_song_likes_count(OLD.song_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS song_likes_count_insert ON public.song_likes;
DROP TRIGGER IF EXISTS song_likes_count_delete ON public.song_likes;

CREATE TRIGGER song_likes_count_insert
AFTER INSERT ON public.song_likes
FOR EACH ROW
EXECUTE FUNCTION public.handle_song_like_count();

CREATE TRIGGER song_likes_count_delete
AFTER DELETE ON public.song_likes
FOR EACH ROW
EXECUTE FUNCTION public.handle_song_like_count();

GRANT EXECUTE ON FUNCTION public.increment_song_play(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_song_likes_count(uuid) TO authenticated;

SELECT public.sync_song_likes_count(id) FROM public.songs;