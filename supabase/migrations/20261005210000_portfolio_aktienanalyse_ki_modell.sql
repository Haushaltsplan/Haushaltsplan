-- Portfolioanalyse: verwendetes KI-Modell pro Aktienanalyse

ALTER TABLE public.portfolio_aktienanalyse
  ADD COLUMN IF NOT EXISTS ki_modell text;

COMMENT ON COLUMN public.portfolio_aktienanalyse.ki_modell IS
  'Gemini-Modell-ID, mit dem die Analyse erzeugt wurde (z. B. gemini-3.5-flash).';
