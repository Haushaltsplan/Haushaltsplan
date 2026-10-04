-- Gemeinkosten-Aufschlag (Verschnitt/Ausschuss) + MwSt-Modell für Margenlogik.

ALTER TABLE public.etsy_shop_einstellungen
  ADD COLUMN IF NOT EXISTS gemeinkosten_aufschlag_pct numeric(5, 2) NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS mwst_satz_pct numeric(5, 2) NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS preis_ist_brutto boolean NOT NULL DEFAULT true;
