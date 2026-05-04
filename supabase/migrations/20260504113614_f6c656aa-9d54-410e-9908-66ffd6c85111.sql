REVOKE EXECUTE ON FUNCTION public.increment_song_play(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_song_play(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_song_play(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_song_likes_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_song_likes_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_song_likes_count(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_song_like_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_song_like_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_song_like_count() FROM authenticated;