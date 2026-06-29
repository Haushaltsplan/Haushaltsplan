-- Score-Verlauf pro Symbol/Playbook (Sparklines in der UI).

CREATE TABLE IF NOT EXISTS public.momentum_scan_verlauf (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      text        NOT NULL,
  playbook    text        NOT NULL,
  scan_date   date        NOT NULL,
  score       integer     NOT NULL,
  ampel       text        NOT NULL,
  erfasst_am  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momentum_scan_verlauf_symbol_datum
  ON public.momentum_scan_verlauf (symbol, scan_date DESC);

COMMENT ON TABLE public.momentum_scan_verlauf IS
  'Momentum Trader: Score-Historie je Symbol und Playbook.';

ALTER TABLE public.momentum_scan_verlauf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_scan_verlauf FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.momentum_scan_verlauf FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
