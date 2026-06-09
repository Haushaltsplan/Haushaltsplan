-- WHOOP OAuth-Tokens pro Nutzer (nicht Browser-Cookie) — funktioniert in Omnia Native + Browser.

CREATE TABLE IF NOT EXISTS public.whoop_oauth_tokens (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at_ms bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whoop_oauth_pending (
  state text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whoop_oauth_pending_expires ON public.whoop_oauth_pending (expires_at);

ALTER TABLE public.whoop_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whoop_oauth_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.whoop_oauth_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whoop_oauth_pending FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.whoop_oauth_tokens FROM anon, PUBLIC;
REVOKE ALL ON public.whoop_oauth_pending FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whoop_oauth_tokens TO authenticated;
GRANT INSERT, DELETE ON public.whoop_oauth_pending TO authenticated;

CREATE POLICY whoop_oauth_tokens_owner_select ON public.whoop_oauth_tokens
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY whoop_oauth_tokens_owner_insert ON public.whoop_oauth_tokens
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY whoop_oauth_tokens_owner_update ON public.whoop_oauth_tokens
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY whoop_oauth_tokens_owner_delete ON public.whoop_oauth_tokens
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY whoop_oauth_pending_owner_insert ON public.whoop_oauth_pending
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY whoop_oauth_pending_owner_delete ON public.whoop_oauth_pending
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
