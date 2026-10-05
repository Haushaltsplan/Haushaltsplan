-- Portfolioanalyse: Aktienanalyse-Historie (Versionen pro Ticker)

CREATE TABLE IF NOT EXISTS public.portfolio_aktienanalyse (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  ticker          text        NOT NULL,
  titel           text        NOT NULL DEFAULT '',
  prompt_snapshot text        NOT NULL DEFAULT '',
  bericht_json    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_aktienanalyse_owner_ticker_idx
  ON public.portfolio_aktienanalyse (owner_user_id, ticker, created_at DESC);

ALTER TABLE public.portfolio_aktienanalyse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_aktienanalyse FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_aktienanalyse FROM anon, PUBLIC, authenticated;

COMMENT ON TABLE public.portfolio_aktienanalyse IS
  'KI-Aktienanalysen (Fundamentaldaten-Export-Kontext); Historie pro Owner+Ticker.';
