-- Momentum Trader Phase 2: SPY 5-Tage-Return im Regime-Snapshot

ALTER TABLE public.momentum_market_regime_daily
  ADD COLUMN IF NOT EXISTS spy_return_5d_pct numeric;

COMMENT ON COLUMN public.momentum_market_regime_daily.spy_return_5d_pct IS
  'S&P 500 5-Tage-Performance in % — für Oversold/Regime-Playbooks.';
