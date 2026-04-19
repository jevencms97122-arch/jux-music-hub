-- ============ SONGS ============
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  genre TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  play_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Songs viewable by everyone" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Users insert own songs" ON public.songs FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users update own songs" ON public.songs FOR UPDATE USING (auth.uid() = uploaded_by);
CREATE POLICY "Users delete own songs" ON public.songs FOR DELETE USING (auth.uid() = uploaded_by);
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_songs_uploaded_by ON public.songs(uploaded_by);
CREATE INDEX idx_songs_created_at ON public.songs(created_at DESC);

-- ============ SONG LIKES ============
CREATE TABLE public.song_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, song_id)
);
ALTER TABLE public.song_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON public.song_likes FOR SELECT USING (true);
CREATE POLICY "Users like songs" ON public.song_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own" ON public.song_likes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_song_likes_song ON public.song_likes(song_id);
CREATE INDEX idx_song_likes_user ON public.song_likes(user_id);

-- ============ LISTEN HISTORY ============
CREATE TABLE public.listen_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  listened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.listen_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own history" ON public.listen_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own history" ON public.listen_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_listen_history_user ON public.listen_history(user_id, listened_at DESC);
CREATE INDEX idx_listen_history_song ON public.listen_history(song_id);

-- ============ PLAYLISTS ============
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  thumbnail_mode TEXT NOT NULL DEFAULT 'grid' CHECK (thumbnail_mode IN ('grid', 'single')),
  view_count INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- ============ PLAYLIST COLLABORATORS ============
CREATE TABLE public.playlist_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('viewer', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, user_id)
);
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_playlist_collaborator(_playlist_id uuid, _user_id uuid, _min_role text DEFAULT 'viewer')
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlist_collaborators
    WHERE playlist_id = _playlist_id AND user_id = _user_id
      AND (_min_role = 'viewer' OR role = 'editor')
  )
$$;

CREATE POLICY "Public or owner or collaborator" ON public.playlists FOR SELECT USING (
  is_public = true OR auth.uid() = owner_id OR public.is_playlist_collaborator(id, auth.uid())
);
CREATE POLICY "Users create playlists" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates playlist" ON public.playlists FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes playlist" ON public.playlists FOR DELETE USING (auth.uid() = owner_id);
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Collaborators visible to playlist viewers" ON public.playlist_collaborators FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.is_public OR p.owner_id = auth.uid()))
);
CREATE POLICY "Owner manages collaborators" ON public.playlist_collaborators FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);

-- ============ PLAYLIST SONGS ============
CREATE TABLE public.playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, song_id)
);
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playlist songs follow playlist visibility" ON public.playlist_songs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.is_public OR p.owner_id = auth.uid() OR public.is_playlist_collaborator(p.id, auth.uid())))
);
CREATE POLICY "Owner or editor adds songs" ON public.playlist_songs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.owner_id = auth.uid() OR public.is_playlist_collaborator(p.id, auth.uid(), 'editor')))
);
CREATE POLICY "Owner or editor removes songs" ON public.playlist_songs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.owner_id = auth.uid() OR public.is_playlist_collaborator(p.id, auth.uid(), 'editor')))
);
CREATE INDEX idx_playlist_songs_playlist ON public.playlist_songs(playlist_id, position);

-- ============ PLAYLIST LIKES ============
CREATE TABLE public.playlist_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, playlist_id)
);
ALTER TABLE public.playlist_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playlist likes viewable" ON public.playlist_likes FOR SELECT USING (true);
CREATE POLICY "Users like playlists" ON public.playlist_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike playlists" ON public.playlist_likes FOR DELETE USING (auth.uid() = user_id);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('songs', 'songs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);

CREATE POLICY "Songs audio publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'songs');
CREATE POLICY "Auth users upload songs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'songs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own audio" ON storage.objects FOR DELETE USING (bucket_id = 'songs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Covers publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Auth users upload covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own covers" ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own covers" ON storage.objects FOR DELETE USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);