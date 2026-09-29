-- Konkurrenz: nur Shops, die überwiegend gedrechselte Holzschalen verkaufen.
-- schalen_anteil = Anteil Holzschalen-Listings am aktiven Sortiment (0–1).
-- manuell = vom Nutzer hinzugefügt (immer verfolgt), ausgeschlossen = nie wieder vorschlagen.

ALTER TABLE public.etsy_konkurrenz_shop
  ADD COLUMN IF NOT EXISTS schalen_anteil numeric(4, 3),
  ADD COLUMN IF NOT EXISTS manuell boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ausgeschlossen boolean NOT NULL DEFAULT false;
