-- Parqet-/TR-CSV: Steuerbetrag pro Buchung (Spalte „tax“), getrennt vom Nettobetrag.

ALTER TABLE public.portfolio_analyse_buchung
  ADD COLUMN IF NOT EXISTS steuer_eur numeric(14, 2);

NOTIFY pgrst, 'reload schema';
