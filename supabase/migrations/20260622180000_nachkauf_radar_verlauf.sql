-- Nachkauf-Radar: Score-Verlauf (Archiv jedes Monatsscans pro Ticker)
-- Ermöglicht Sparklines und Trend-Erkennung im UI.

CREATE TABLE IF NOT EXISTS public.nachkauf_radar_scan_verlauf (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker      text        NOT NULL,
  score       integer     NOT NULL CHECK (score >= 0 AND score <= 100),
  ampel       text        NOT NULL,
  mantra_ampel text,
  fcf_yield_pct numeric(6,2),
  forward_pe    numeric(8,2),
  gescannt_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nachkauf_radar_verlauf_ticker_datum_idx
  ON public.nachkauf_radar_scan_verlauf (ticker, gescannt_am DESC);

-- Service Role hat vollen Zugriff (kein RLS — wie die anderen Nachkauf-Tabellen)
GRANT SELECT, INSERT, DELETE ON TABLE public.nachkauf_radar_scan_verlauf TO service_role;

-- Alte Einträge automatisch nach 24 Monaten löschen (optional, sauber halten)
-- Kann als Cron-Job eingerichtet werden; hier als Kommentar dokumentiert:
-- DELETE FROM nachkauf_radar_scan_verlauf WHERE gescannt_am < now() - interval '24 months';

NOTIFY pgrst, 'reload schema';
