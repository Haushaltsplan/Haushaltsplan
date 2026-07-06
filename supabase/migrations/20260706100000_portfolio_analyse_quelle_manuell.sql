-- Manuelle Buchungen in der Portfolioanalyse (Import-UI)

ALTER TABLE public.portfolio_analyse_buchung
  DROP CONSTRAINT IF EXISTS portfolio_analyse_buchung_quelle_check;

ALTER TABLE public.portfolio_analyse_buchung
  ADD CONSTRAINT portfolio_analyse_buchung_quelle_check
  CHECK (quelle IN ('pdf', 'csv', 'manuell'));

NOTIFY pgrst, 'reload schema';
