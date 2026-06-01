-- Parqet-CSV: Spalte „realizedgains“ pro Verkauf (FIFO laut Parqet)

ALTER TABLE public.portfolio_analyse_buchung
  ADD COLUMN IF NOT EXISTS realisierter_gewinn_eur numeric(14, 2);
