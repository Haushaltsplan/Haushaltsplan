-- Momentum Trader Phase 5: Insider-Käufe (Form 4 Cache)

CREATE TABLE IF NOT EXISTS public.momentum_insider_trades (
  symbol          text        NOT NULL,
  trade_date      date        NOT NULL,
  filing_date     date        NOT NULL,
  insider_name    text        NOT NULL,
  title           text,
  trade_type      text        NOT NULL CHECK (trade_type IN ('purchase', 'sale')),
  value_usd       numeric,
  qty             numeric,
  price           numeric,
  quelle          text        NOT NULL DEFAULT 'openinsider',
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, trade_date, insider_name, trade_type)
);

CREATE INDEX IF NOT EXISTS idx_momentum_insider_symbol_datum
  ON public.momentum_insider_trades (symbol, trade_date DESC);

ALTER TABLE public.momentum_insider_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_insider_trades FORCE ROW LEVEL SECURITY;

CREATE POLICY momentum_insider_trades_service_all
  ON public.momentum_insider_trades FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY momentum_insider_trades_read
  ON public.momentum_insider_trades FOR SELECT TO authenticated USING (true);
