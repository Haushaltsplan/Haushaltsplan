-- Freitext-Notiz pro Watchlist-Titel (Beobachtungen, Earnings-Notizen).

ALTER TABLE public.momentum_watchlist
  ADD COLUMN IF NOT EXISTS notiz text;

COMMENT ON COLUMN public.momentum_watchlist.notiz IS
  'Persönliche Notiz zum Titel (Earnings-Erwartung, Setup-Hinweise).';

NOTIFY pgrst, 'reload schema';
