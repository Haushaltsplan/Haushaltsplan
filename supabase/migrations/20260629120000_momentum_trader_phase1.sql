-- Momentum Trader — Phase 1: Rohdaten + Journal (getrennt vom Nachkauf-Radar).

-- Tägliche OHLCV-Kerzen (Basis für Gap, RVOL, ATR, RS)
CREATE TABLE IF NOT EXISTS public.momentum_bars_daily (
  symbol      text           NOT NULL,
  handelstag  date           NOT NULL,
  open        numeric        NOT NULL,
  high        numeric        NOT NULL,
  low         numeric        NOT NULL,
  close       numeric        NOT NULL,
  adj_close   numeric,
  volume      bigint         NOT NULL DEFAULT 0,
  erfasst_am  timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, handelstag)
);

CREATE INDEX IF NOT EXISTS idx_momentum_bars_daily_tag
  ON public.momentum_bars_daily (handelstag DESC);

COMMENT ON TABLE public.momentum_bars_daily IS
  'Momentum Trader: tägliche OHLCV-Kerzen je Symbol.';

-- Vorausschauender Earnings-Kalender (marktweit, nicht nur Depot)
CREATE TABLE IF NOT EXISTS public.momentum_earnings_calendar (
  symbol            text        NOT NULL,
  earnings_date     date        NOT NULL,
  time_bmo_amc      text        NOT NULL DEFAULT 'unknown'
                                CHECK (time_bmo_amc IN ('bmo', 'amc', 'dmh', 'unknown')),
  eps_estimate      numeric,
  revenue_estimate  numeric,
  quarter           integer,
  year              integer,
  aktualisiert_am   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, earnings_date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_earnings_calendar_datum
  ON public.momentum_earnings_calendar (earnings_date);

COMMENT ON TABLE public.momentum_earnings_calendar IS
  'Momentum Trader: anstehende Earnings-Termine mit Schätzungen.';

-- Vergangene Earnings-Events inkl. Kursreaktion (Backfill)
CREATE TABLE IF NOT EXISTS public.momentum_earnings_events (
  symbol              text        NOT NULL,
  earnings_date       date        NOT NULL,
  time_bmo_amc        text        NOT NULL DEFAULT 'unknown'
                                  CHECK (time_bmo_amc IN ('bmo', 'amc', 'dmh', 'unknown')),
  eps_estimate        numeric,
  eps_actual          numeric,
  revenue_estimate    numeric,
  revenue_actual      numeric,
  surprise_eps_pct    numeric,
  surprise_rev_pct    numeric,
  guidance_flag       text        NOT NULL DEFAULT 'unknown'
                                  CHECK (guidance_flag IN ('raise', 'lower', 'inline', 'unknown')),
  price_prev_close    numeric,
  open_gap            numeric,
  close_day1          numeric,
  gap_pct             numeric,
  rvol                numeric,
  erfasst_am          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, earnings_date)
);

COMMENT ON TABLE public.momentum_earnings_events IS
  'Momentum Trader: historische Earnings mit gemessener Kursreaktion.';

-- Markt-Regime (SPY, VIX, MAs) — täglich ein Snapshot
CREATE TABLE IF NOT EXISTS public.momentum_market_regime_daily (
  handelstag          date        PRIMARY KEY,
  spy_close           numeric,
  spy_ma20            numeric,
  spy_above_20ma      boolean,
  vix_close           numeric,
  vix_change_pct      numeric,
  erfasst_am          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.momentum_market_regime_daily IS
  'Momentum Trader: täglicher Markt-Regime-Snapshot für Hard Gates.';

-- Scan-Ergebnisse (regelbasiert, Stufe A)
CREATE TABLE IF NOT EXISTS public.momentum_scan_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date       date        NOT NULL,
  symbol          text        NOT NULL,
  playbook        text        NOT NULL,
  score           integer     NOT NULL DEFAULT 0,
  ampel           text        NOT NULL DEFAULT 'grau'
                              CHECK (ampel IN ('gruen', 'gelb', 'rot', 'grau')),
  gates_passed    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  gates_failed    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  indikatoren     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momentum_scan_results_datum
  ON public.momentum_scan_results (scan_date DESC, score DESC);

COMMENT ON TABLE public.momentum_scan_results IS
  'Momentum Trader: tägliche Setup-Kandidaten aus der Regel-Engine.';

-- Trade-Journal (nutzerbezogen)
CREATE TABLE IF NOT EXISTS public.momentum_trades (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid        NOT NULL DEFAULT auth.uid(),
  symbol            text        NOT NULL,
  playbook          text        NOT NULL,
  direction         text        NOT NULL CHECK (direction IN ('long', 'short')),
  entry_date        date        NOT NULL,
  entry_price       numeric     NOT NULL,
  stop_price        numeric,
  target_price      numeric,
  exit_date         date,
  exit_price        numeric,
  risk_eur          numeric     NOT NULL DEFAULT 10,
  pnl_eur           numeric,
  rule_compliance   boolean     NOT NULL DEFAULT true,
  notizen           text,
  erstellt_am       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momentum_trades_owner
  ON public.momentum_trades (owner_user_id, entry_date DESC);

COMMENT ON TABLE public.momentum_trades IS
  'Momentum Trader: manuelles Trade-Journal mit PnL und Regel-Compliance.';

-- Rohdaten + Scans: nur Service Role (wie Nachkauf-Radar Scan)
ALTER TABLE public.momentum_bars_daily            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_bars_daily            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_earnings_calendar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_earnings_calendar     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_earnings_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_earnings_events       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_market_regime_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_market_regime_daily   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_scan_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_scan_results          FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.momentum_bars_daily          FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.momentum_earnings_calendar   FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.momentum_earnings_events     FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.momentum_market_regime_daily FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.momentum_scan_results        FROM anon, PUBLIC, authenticated;

-- Journal: RLS pro User
ALTER TABLE public.momentum_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nur eigene Momentum-Trades lesen"
  ON public.momentum_trades FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Nur eigene Momentum-Trades schreiben"
  ON public.momentum_trades FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Nur eigene Momentum-Trades aktualisieren"
  ON public.momentum_trades FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Nur eigene Momentum-Trades löschen"
  ON public.momentum_trades FOR DELETE
  USING (owner_user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
