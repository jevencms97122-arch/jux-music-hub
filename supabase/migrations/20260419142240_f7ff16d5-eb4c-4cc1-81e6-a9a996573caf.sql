-- ============ FOLLOWS ============
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows visible to involved parties" ON public.follows FOR SELECT USING (
  auth.uid() = follower_id OR auth.uid() = following_id
);
CREATE POLICY "Users create own follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Following user can accept" ON public.follows FOR UPDATE USING (auth.uid() = following_id);
CREATE POLICY "Either party can delete" ON public.follows FOR DELETE USING (
  auth.uid() = follower_id OR auth.uid() = following_id
);
CREATE INDEX idx_follows_follower ON public.follows(follower_id, status);
CREATE INDEX idx_follows_following ON public.follows(following_id, status);

-- ============ STORIES ============
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  start_time NUMERIC NOT NULL DEFAULT 0,
  end_time NUMERIC NOT NULL DEFAULT 15,
  comment TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time - start_time <= 15)
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active stories visible to all" ON public.stories FOR SELECT USING (expires_at > now());
CREATE POLICY "Users create own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_stories_user ON public.stories(user_id);
CREATE INDEX idx_stories_expires ON public.stories(expires_at);

-- ============ STORY VIEWS ============
CREATE TABLE public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story owner sees views" ON public.story_views FOR SELECT USING (
  auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users record own views" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- ============ SONG COMMENTS ============
CREATE TABLE public.song_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.song_comments FOR SELECT USING (true);
CREATE POLICY "Users post comments" ON public.song_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.song_comments FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_song_comments_song ON public.song_comments(song_id, created_at DESC);

-- ============ LISTEN SESSIONS ============
CREATE TABLE public.listen_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  current_time_seconds NUMERIC NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  participants UUID[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.listen_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions visible to host & participants" ON public.listen_sessions FOR SELECT USING (
  auth.uid() = host_id OR auth.uid() = ANY(participants)
);
CREATE POLICY "Users create sessions" ON public.listen_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host updates session" ON public.listen_sessions FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Host deletes session" ON public.listen_sessions FOR DELETE USING (auth.uid() = host_id);
CREATE TRIGGER update_listen_sessions_updated_at BEFORE UPDATE ON public.listen_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER STATS (streaks) ============
CREATE TABLE public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_listens INTEGER NOT NULL DEFAULT 0,
  last_listen_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stats publicly visible" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "Users update own stats" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own stats" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_song','milestone','friend_request','like','comment','story_view')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Anyone authenticated creates notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users mark own as read" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = recipient_id);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);

-- ============ APP VERSIONS (PWA update check) ============
CREATE TABLE public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_version INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App versions readable by all" ON public.app_versions FOR SELECT USING (true);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listen_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_comments;