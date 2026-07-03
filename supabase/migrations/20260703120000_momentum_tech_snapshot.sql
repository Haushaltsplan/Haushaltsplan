-- Momentum Trader 2.0: technische Snapshots pro Symbol/Scan-Tag

CREATE TABLE IF NOT EXISTS public.momentum_tech_snapshot (
  symbol          text        NOT NULL,
  scan_date       date        NOT NULL,
  handelstag      date        NOT NULL,
  snapshot        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_tech_snapshot_datum
  ON public.momentum_tech_snapshot (scan_date DESC);

COMMENT ON TABLE public.momentum_tech_snapshot IS
  'Momentum Trader: RSI, MA, RS, Gap — Basis für tägliche Playbooks.';

ALTER TABLE public.momentum_tech_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_tech_snapshot FORCE ROW LEVEL SECURITY;

CREATE POLICY momentum_tech_snapshot_service_all
  ON public.momentum_tech_snapshot
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY momentum_tech_snapshot_authenticated_read
  ON public.momentum_tech_snapshot
  FOR SELECT
  TO authenticated
  USING (true);
