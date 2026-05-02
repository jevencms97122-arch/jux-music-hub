-- Ajout d'un code court à 4 chiffres pour les sessions d'écoute + suivi readiness
ALTER TABLE public.listen_sessions
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS ready_participants uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE UNIQUE INDEX IF NOT EXISTS listen_sessions_code_active_idx
  ON public.listen_sessions(code) WHERE is_active = true;

-- Permettre aux participants de mettre à jour ready_participants
DROP POLICY IF EXISTS "Participants update readiness" ON public.listen_sessions;
CREATE POLICY "Participants update readiness"
ON public.listen_sessions
FOR UPDATE
USING (auth.uid() = ANY (participants))
WITH CHECK (auth.uid() = ANY (participants));

-- Permettre à un invité de rejoindre une session active (s'ajouter aux participants)
DROP POLICY IF EXISTS "Authenticated can join active session" ON public.listen_sessions;
CREATE POLICY "Authenticated can join active session"
ON public.listen_sessions
FOR UPDATE
USING (is_active = true AND auth.uid() IS NOT NULL)
WITH CHECK (is_active = true AND auth.uid() IS NOT NULL);

-- Lecture par code: rendre les sessions actives lisibles aux invités (pour pouvoir les trouver via code)
DROP POLICY IF EXISTS "Active sessions readable by code" ON public.listen_sessions;
CREATE POLICY "Active sessions readable by code"
ON public.listen_sessions
FOR SELECT
USING (is_active = true);