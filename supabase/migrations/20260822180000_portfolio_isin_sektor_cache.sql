-- ISIN → Sektor/Branche (Yahoo assetProfile, geräteübergreifend)
CREATE TABLE IF NOT EXISTS public.portfolio_isin_sektor_cache (
  isin            text PRIMARY KEY,
  sektor          text,
  branche         text,
  symbol_yahoo    text,
  quelle          text NOT NULL DEFAULT 'yahoo',
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_isin_sektor_cache_aktualisiert
  ON public.portfolio_isin_sektor_cache (aktualisiert_am DESC);

ALTER TABLE public.portfolio_isin_sektor_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio-Sektor-Cache lesen"
  ON public.portfolio_isin_sektor_cache FOR SELECT
  USING (true);

CREATE POLICY "Portfolio-Sektor-Cache schreiben"
  ON public.portfolio_isin_sektor_cache FOR ALL
  USING (true) WITH CHECK (true);
