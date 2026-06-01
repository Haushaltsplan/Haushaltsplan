-- Parqet-CSV: realizedgains (Sell) + Original-type (Sell vs. TransferOut)

ALTER TABLE public.portfolio_analyse_buchung
  ADD COLUMN IF NOT EXISTS realisierter_gewinn_eur numeric(14, 2);

ALTER TABLE public.portfolio_analyse_buchung
  ADD COLUMN IF NOT EXISTS parqet_typ text;
