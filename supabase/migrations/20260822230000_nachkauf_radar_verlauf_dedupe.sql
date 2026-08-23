-- Ein Punkt pro Ticker und Kalendertag (UTC) — verhindert Multi-Insert bei Rescans.
ALTER TABLE public.nachkauf_radar_scan_verlauf
  ADD COLUMN IF NOT EXISTS scan_datum date
  GENERATED ALWAYS AS ((gescannt_am AT TIME ZONE 'UTC')::date) STORED;

-- Alte Duplikate bereinigen (letzten Stand pro Tag behalten)
DELETE FROM public.nachkauf_radar_scan_verlauf a
USING public.nachkauf_radar_scan_verlauf b
WHERE a.ticker = b.ticker
  AND ((a.gescannt_am AT TIME ZONE 'UTC')::date) = ((b.gescannt_am AT TIME ZONE 'UTC')::date)
  AND a.gescannt_am < b.gescannt_am;

CREATE UNIQUE INDEX IF NOT EXISTS nachkauf_radar_verlauf_ticker_scan_datum_uidx
  ON public.nachkauf_radar_scan_verlauf (ticker, scan_datum);
