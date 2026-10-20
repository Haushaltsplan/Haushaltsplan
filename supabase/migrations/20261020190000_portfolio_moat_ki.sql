-- KI-Moat-Bewertung (qualitative Burggraben-Pfeiler) — geräteübergreifend.
-- Zugriff nur über Service Role in API-Routen.

CREATE TABLE IF NOT EXISTS public.portfolio_moat_ki (
  ticker text NOT NULL PRIMARY KEY,
  isin text,
  firmenname text,
  payload jsonb NOT NULL,
  ki_modell text,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_moat_ki_aktualisiert
  ON public.portfolio_moat_ki (aktualisiert_am DESC);

COMMENT ON TABLE public.portfolio_moat_ki IS
  'KI-Moat-Check (Preissetzung, Replikation, Wechselkosten, Marktdichte) — Free-Tier Gemini, gecacht.';

ALTER TABLE public.portfolio_moat_ki ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_moat_ki FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.portfolio_moat_ki FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
