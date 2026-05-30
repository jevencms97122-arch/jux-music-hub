-- ============ USER PRESENCE (what friends are listening to) ============
CREATE TABLE public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_listening BOOLEAN NOT NULL DEFAULT false,
  current_song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  current_song_title TEXT,
  current_song_author TEXT,
  current_song_cover_url TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les présences (nécessaire pour la page Social)
CREATE POLICY "Presence publicly visible" ON public.user_presence FOR SELECT USING (true);

-- L'utilisateur peut mettre à jour sa propre présence
CREATE POLICY "Users update own presence" ON public.user_presence FOR UPDATE USING (auth.uid() = user_id);

-- L'utilisateur peut insérer sa propre présence
CREATE POLICY "Users insert own presence" ON public.user_presence FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour requêtes rapides par user_id
CREATE INDEX idx_user_presence_user_id ON public.user_presence(user_id);

-- Index pour trouver les amis en écoute
CREATE INDEX idx_user_presence_listening ON public.user_presence(is_listening) WHERE is_listening = true;