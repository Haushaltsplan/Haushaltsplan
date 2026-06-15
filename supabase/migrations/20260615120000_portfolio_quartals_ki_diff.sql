-- Quartals-zu-Quartals-KI-Diff (gecacht)

CREATE TABLE IF NOT EXISTS public.portfolio_quartals_ki_diff (
  cache_key text PRIMARY KEY,
  ticker text NOT NULL,
  typ text NOT NULL,
  aktuell_id text NOT NULL,
  vorher_id text NOT NULL,
  diff text NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_quartals_ki_diff_ticker
  ON public.portfolio_quartals_ki_diff (ticker);

ALTER TABLE public.portfolio_quartals_ki_diff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_quartals_ki_diff FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portfolio_quartals_ki_diff FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
