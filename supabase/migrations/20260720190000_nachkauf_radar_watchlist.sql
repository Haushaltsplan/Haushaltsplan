-- Nachkauf-Radar: Watchlist-Kandidaten (Sync der Portfolioanalyse-Watchlist aus dem Browser).
-- Der Radar-Scan (auch Cron) liest diese Tabelle und scannt die Titel zusätzlich zur festen Whitelist.
-- Zugriff nur über Service Role in API-Routen — nicht über den Browser-Anon-Key.

CREATE TABLE IF NOT EXISTS public.nachkauf_radar_watchlist (
  isin text PRIMARY KEY,
  name text NOT NULL,
  symbol_yahoo text,
  symbol_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  hinzugefuegt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nachkauf_radar_watchlist IS
  'Portfolioanalyse-Watchlist (Cloud-Sync) — wird im Nachkauf-Radar zusätzlich zur Whitelist gescannt.';

ALTER TABLE public.nachkauf_radar_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachkauf_radar_watchlist FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nachkauf_radar_watchlist FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
