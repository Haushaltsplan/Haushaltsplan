-- YouTube OAuth: Tokens + Pending (PKCE) pro Nutzer.

CREATE TABLE IF NOT EXISTS public.youtube_oauth_tokens (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at_ms bigint NOT NULL,
  channel_id text,
  channel_title text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.youtube_oauth_pending (
  state text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_youtube_oauth_pending_expires ON public.youtube_oauth_pending (expires_at);

ALTER TABLE public.youtube_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_oauth_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_oauth_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_oauth_pending FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.youtube_oauth_tokens FROM anon, PUBLIC;
REVOKE ALL ON public.youtube_oauth_pending FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_oauth_tokens TO authenticated;
GRANT INSERT, DELETE ON public.youtube_oauth_pending TO authenticated;

CREATE POLICY youtube_oauth_tokens_owner ON public.youtube_oauth_tokens
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY youtube_oauth_pending_owner_insert ON public.youtube_oauth_pending
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY youtube_oauth_pending_owner_delete ON public.youtube_oauth_pending
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());
