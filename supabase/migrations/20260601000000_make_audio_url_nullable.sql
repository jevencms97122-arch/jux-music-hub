-- Allow audio_url to be NULL for YouTube-only songs
ALTER TABLE public.songs ALTER COLUMN audio_url DROP NOT NULL;
ALTER TABLE public.songs ALTER COLUMN audio_url SET DEFAULT NULL;