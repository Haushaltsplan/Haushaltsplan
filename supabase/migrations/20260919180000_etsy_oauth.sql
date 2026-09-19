-- Etsy OAuth: Tokens + Pending (inkl. PKCE code_verifier) pro Nutzer.

CREATE TABLE IF NOT EXISTS public.etsy_oauth_tokens (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at_ms bigint NOT NULL,
  etsy_user_id bigint,
  shop_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.etsy_oauth_pending (
  state text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_etsy_oauth_pending_expires ON public.etsy_oauth_pending (expires_at);

ALTER TABLE public.etsy_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_oauth_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_oauth_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_oauth_pending FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_oauth_tokens FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_oauth_pending FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_oauth_tokens TO authenticated;
GRANT INSERT, DELETE ON public.etsy_oauth_pending TO authenticated;

CREATE POLICY etsy_oauth_tokens_owner ON public.etsy_oauth_tokens
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_oauth_pending_owner_insert ON public.etsy_oauth_pending
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_oauth_pending_owner_delete ON public.etsy_oauth_pending
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());
