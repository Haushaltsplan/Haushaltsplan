-- Portfolioanalyse: Vorschaubild (SVG) für Aktienanalyse-Einträge

ALTER TABLE public.portfolio_aktienanalyse
  ADD COLUMN IF NOT EXISTS thumbnail_svg text;

COMMENT ON COLUMN public.portfolio_aktienanalyse.thumbnail_svg IS
  'Editorial SVG-Vorschaubild der Analyse (inline, ohne Storage-Bucket).';
