-- Nachkauf-Radar Optimierung: historische Mediane persistieren + Empfehlungs-Tracking.

ALTER TABLE public.nachkauf_radar_scan
  ADD COLUMN IF NOT EXISTS historischer_median_pe real,
  ADD COLUMN IF NOT EXISTS historischer_median_fcf_yield real,
  ADD COLUMN IF NOT EXISTS historisch_quelle text;

COMMENT ON COLUMN public.nachkauf_radar_scan.historisch_quelle IS
  'macrotrends | whitelist — Quelle der 5J-Median-Bewertung';

CREATE TABLE IF NOT EXISTS public.nachkauf_empfehlung_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  monat text NOT NULL,
  ticker text NOT NULL,
  isin text,
  name text,
  empfohlen_betrag_eur numeric(10, 2) NOT NULL DEFAULT 0,
  score integer NOT NULL,
  ampel text,
  kauf_trigger boolean NOT NULL DEFAULT false,
  forward_pe numeric(8, 2),
  premium_discount_pct numeric(6, 2),
  kurs_usd numeric(12, 4),
  empfohlen_am timestamptz NOT NULL DEFAULT now(),
  kurs_6m_usd numeric(12, 4),
  kurs_12m_usd numeric(12, 4),
  rendite_6m_pct numeric(8, 2),
  rendite_12m_pct numeric(8, 2),
  spy_rendite_6m_pct numeric(8, 2),
  spy_rendite_12m_pct numeric(8, 2),
  ausgewertet_6m_am timestamptz,
  ausgewertet_12m_am timestamptz,
  UNIQUE (owner_user_id, monat, ticker)
);

CREATE INDEX IF NOT EXISTS idx_nachkauf_empfehlung_tracking_monat
  ON public.nachkauf_empfehlung_tracking (monat DESC);

CREATE INDEX IF NOT EXISTS idx_nachkauf_empfehlung_tracking_empfohlen
  ON public.nachkauf_empfehlung_tracking (empfohlen_am DESC);

COMMENT ON TABLE public.nachkauf_empfehlung_tracking IS
  'Nachkauf-Empfehlungen mit Forward-Performance (6M/12M vs. SPY).';

ALTER TABLE public.nachkauf_empfehlung_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachkauf_empfehlung_tracking FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nachkauf_empfehlung_tracking FROM anon, PUBLIC, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nachkauf_empfehlung_tracking TO service_role;

NOTIFY pgrst, 'reload schema';
