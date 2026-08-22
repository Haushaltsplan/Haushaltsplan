-- Mantra-Qualitätsscore-Verlauf pro Titel und Periode (Quartal/FY)
CREATE TABLE IF NOT EXISTS public.fundamental_mantra_verlauf (
  ticker              text NOT NULL,
  periode_iso         text NOT NULL,
  isin                text,
  ampel               text NOT NULL,
  ampel_score_pct     integer,
  score_mantra        integer,
  sell_trigger_ok     boolean NOT NULL DEFAULT true,
  erfuellt            integer NOT NULL DEFAULT 0,
  nicht_erfuellt      integer NOT NULL DEFAULT 0,
  qualitativ          integer NOT NULL DEFAULT 0,
  keine_daten         integer NOT NULL DEFAULT 0,
  erfasst_am          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, periode_iso)
);

CREATE INDEX IF NOT EXISTS fundamental_mantra_verlauf_isin
  ON public.fundamental_mantra_verlauf (isin);

ALTER TABLE public.fundamental_mantra_verlauf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mantra-Verlauf lesen"
  ON public.fundamental_mantra_verlauf FOR SELECT
  USING (true);

CREATE POLICY "Mantra-Verlauf schreiben"
  ON public.fundamental_mantra_verlauf FOR ALL
  USING (true) WITH CHECK (true);
