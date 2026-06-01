-- Parqet-CSV: Original-Spalte „type“ (Sell vs. TransferOut für Realisiert-Summe)

ALTER TABLE public.portfolio_analyse_buchung
  ADD COLUMN IF NOT EXISTS parqet_typ text;
