DELETE FROM public.song_likes a
USING public.song_likes b
WHERE a.user_id = b.user_id
  AND a.song_id = b.song_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_song_likes_unique_user_song
ON public.song_likes(user_id, song_id);