-- Momentum Trader Phase 3: News- & Analyst-Katalysatoren

CREATE TABLE IF NOT EXISTS public.momentum_news_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          text        NOT NULL,
  datum           date        NOT NULL,
  headline        text        NOT NULL,
  sentiment       text        NOT NULL CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  quelle          text        NOT NULL DEFAULT 'google_news',
  href            text,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momentum_news_symbol_datum
  ON public.momentum_news_events (symbol, datum DESC);

CREATE TABLE IF NOT EXISTS public.momentum_analyst_ratings (
  symbol          text        NOT NULL,
  datum           date        NOT NULL,
  aktion          text        NOT NULL CHECK (aktion IN ('upgrade', 'downgrade', 'initiate', 'reiterate', 'target')),
  firma           text,
  rating_alt      text,
  rating_neu      text,
  zielpreis_alt   numeric,
  zielpreis_neu   numeric,
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, datum, aktion, firma)
);

CREATE INDEX IF NOT EXISTS idx_momentum_analyst_symbol
  ON public.momentum_analyst_ratings (symbol, datum DESC);

ALTER TABLE public.momentum_news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_news_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_analyst_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_analyst_ratings FORCE ROW LEVEL SECURITY;

CREATE POLICY momentum_news_events_service_all
  ON public.momentum_news_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY momentum_news_events_read
  ON public.momentum_news_events FOR SELECT TO authenticated USING (true);

CREATE POLICY momentum_analyst_ratings_service_all
  ON public.momentum_analyst_ratings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY momentum_analyst_ratings_read
  ON public.momentum_analyst_ratings FOR SELECT TO authenticated USING (true);
