-- Top-Signal-Tracking: archivierte aktive Signale + Outcome nach 5 Handelstagen.

CREATE TABLE IF NOT EXISTS public.momentum_top_signals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol              text        NOT NULL,
  playbook            text        NOT NULL,
  scan_date           date        NOT NULL,
  direction           text        NOT NULL CHECK (direction IN ('long', 'short')),
  score               integer     NOT NULL,
  ampel               text        NOT NULL,
  erfolg_pct          integer     NOT NULL,
  entry_price         numeric     NOT NULL,
  stop_price          numeric     NOT NULL,
  target_price        numeric     NOT NULL,
  outcome             text        NOT NULL DEFAULT 'pending'
                                  CHECK (outcome IN ('pending', 'win', 'loss', 'timeout')),
  outcome_resolved_am timestamptz,
  erfasst_am          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, playbook, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_top_signals_datum
  ON public.momentum_top_signals (scan_date DESC);

CREATE INDEX IF NOT EXISTS idx_momentum_top_signals_outcome
  ON public.momentum_top_signals (outcome, scan_date DESC);

COMMENT ON TABLE public.momentum_top_signals IS
  'Momentum Trader: archivierte Top-Signale (erfolgIstAktiv) mit Forward-Outcome.';

ALTER TABLE public.momentum_top_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_top_signals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.momentum_top_signals FROM anon, PUBLIC, authenticated;

-- Journal-Verknüpfung zum Scan-Signal
ALTER TABLE public.momentum_trades
  ADD COLUMN IF NOT EXISTS scan_date date,
  ADD COLUMN IF NOT EXISTS signal_erfolg_pct integer,
  ADD COLUMN IF NOT EXISTS aus_scan boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.momentum_trades.scan_date IS
  'Scan-Datum des Signals, aus dem der Trade erfasst wurde.';
COMMENT ON COLUMN public.momentum_trades.signal_erfolg_pct IS
  'Erfolgswahrscheinlichkeit (%) zum Zeitpunkt der Signalerfassung.';
COMMENT ON COLUMN public.momentum_trades.aus_scan IS
  'True wenn Trade direkt aus einem Scan-Signal erfasst wurde.';

NOTIFY pgrst, 'reload schema';
