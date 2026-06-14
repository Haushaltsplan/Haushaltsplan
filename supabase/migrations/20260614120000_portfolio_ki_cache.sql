-- Portfolio-Analyse: KI-Zusammenfassungen (SEC-Berichte & Earnings Calls) geräteübergreifend.
-- Zugriff nur über Service Role in API-Routen — nicht über den Browser-Anon-Key.

CREATE TABLE IF NOT EXISTS public.portfolio_sec_bericht_ki (
  ticker text NOT NULL,
  bericht_id text NOT NULL,
  accession text NOT NULL DEFAULT '',
  zusammenfassung text NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, bericht_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_sec_bericht_ki_ticker
  ON public.portfolio_sec_bericht_ki (ticker);

COMMENT ON TABLE public.portfolio_sec_bericht_ki IS
  'KI-Zusammenfassungen zu SEC 10-Q/10-K — synchron zwischen Laptop & Handy über Supabase.';

CREATE TABLE IF NOT EXISTS public.portfolio_earnings_call_ki (
  ticker text NOT NULL,
  quartal_id text NOT NULL,
  transcript_url text NOT NULL DEFAULT '',
  zusammenfassung text NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, quartal_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_earnings_call_ki_ticker
  ON public.portfolio_earnings_call_ki (ticker);

COMMENT ON TABLE public.portfolio_earnings_call_ki IS
  'KI-Zusammenfassungen zu Earnings-Call-Transkripten — synchron zwischen Laptop & Handy über Supabase.';

ALTER TABLE public.portfolio_sec_bericht_ki ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_sec_bericht_ki FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_earnings_call_ki ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_earnings_call_ki FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_sec_bericht_ki FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.portfolio_earnings_call_ki FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
