-- Portfolioanalyse: Alerts-Inbox, Zielallokation, Investment-Journal

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_analyse_alerts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  typ           text        NOT NULL
                            CHECK (typ IN ('radar_gruen', 'radar_kaufzone', 'earnings_heute', 'earnings_morgen', 'drawdown')),
  ticker        text,
  isin          text,
  titel         text        NOT NULL DEFAULT '',
  nachricht     text        NOT NULL DEFAULT '',
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  gelesen_am    timestamptz,
  erstellt_am   timestamptz NOT NULL DEFAULT now(),
  dedupe_key    text        NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_analyse_alerts_dedupe_uidx
  ON public.portfolio_analyse_alerts (owner_user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS portfolio_analyse_alerts_owner_ungelesen_idx
  ON public.portfolio_analyse_alerts (owner_user_id, erstellt_am DESC)
  WHERE gelesen_am IS NULL;

ALTER TABLE public.portfolio_analyse_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_analyse_alerts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_analyse_alerts FROM anon, PUBLIC, authenticated;

-- ---------------------------------------------------------------------------
-- Zielallokation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_zielallokation (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  dimension     text        NOT NULL CHECK (dimension IN ('assetklasse', 'sektor', 'titel')),
  schluessel    text        NOT NULL,
  label         text        NOT NULL DEFAULT '',
  ziel_pct      real        NOT NULL CHECK (ziel_pct >= 0 AND ziel_pct <= 100),
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, dimension, schluessel)
);

ALTER TABLE public.portfolio_zielallokation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_zielallokation FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_zielallokation FROM anon, PUBLIC, authenticated;

-- ---------------------------------------------------------------------------
-- Investment-Journal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_investment_journal (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  isin          text,
  ticker        text        NOT NULL DEFAULT '',
  name          text        NOT NULL DEFAULT '',
  these         text        NOT NULL DEFAULT '',
  kaufgrund     text        NOT NULL DEFAULT '',
  watchpoints   text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'aktiv'
                            CHECK (status IN ('aktiv', 'geschlossen')),
  review_am     date,
  erstellt_am   timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_investment_journal_owner_idx
  ON public.portfolio_investment_journal (owner_user_id, aktualisiert_am DESC);

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_investment_journal_owner_ticker_uidx
  ON public.portfolio_investment_journal (owner_user_id, ticker)
  WHERE ticker <> '' AND status = 'aktiv';

ALTER TABLE public.portfolio_investment_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_investment_journal FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_investment_journal FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
