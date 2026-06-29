-- Momentum Watchlist: optionales IPO-Datum (Finnhub oder manuell).

ALTER TABLE public.momentum_watchlist
  ADD COLUMN IF NOT EXISTS ipo_datum date,
  ADD COLUMN IF NOT EXISTS ipo_sync_am timestamptz;

COMMENT ON COLUMN public.momentum_watchlist.ipo_datum IS
  'IPO-Listing-Datum für IPO-Fade-Playbook (Finnhub profile2 oder manuell).';

NOTIFY pgrst, 'reload schema';
