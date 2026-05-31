-- Table pour les collaborations / artistes mis en avant
CREATE TABLE IF NOT EXISTS collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudo TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  twitch_url TEXT,
  youtube_url TEXT,
  discord_url TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  tiktok_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_collaborations_active ON collaborations(active);
CREATE INDEX idx_collaborations_sort ON collaborations(sort_order);