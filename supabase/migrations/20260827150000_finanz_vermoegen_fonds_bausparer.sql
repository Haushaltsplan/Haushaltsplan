-- Fonds: ISIN + Anteilanzahl + letzter Kurs.
-- Bausparer: ab welchem Monat Ausgaben automatisch auf den Stand addiert werden.

ALTER TABLE public.finanz_vermoegen
  ADD COLUMN IF NOT EXISTS isin text;

ALTER TABLE public.finanz_vermoegen
  ADD COLUMN IF NOT EXISTS anzahl numeric(18,6);

ALTER TABLE public.finanz_vermoegen
  ADD COLUMN IF NOT EXISTS kurs_eur numeric(14,6);

ALTER TABLE public.finanz_vermoegen
  ADD COLUMN IF NOT EXISTS auto_ab_monat text;

ALTER TABLE public.finanz_vermoegen
  DROP CONSTRAINT IF EXISTS finanz_vermoegen_isin_fmt;

ALTER TABLE public.finanz_vermoegen
  ADD CONSTRAINT finanz_vermoegen_isin_fmt
  CHECK (isin IS NULL OR isin ~ '^[A-Z]{2}[A-Z0-9]{10}$');

ALTER TABLE public.finanz_vermoegen
  DROP CONSTRAINT IF EXISTS finanz_vermoegen_auto_ab_monat_fmt;

ALTER TABLE public.finanz_vermoegen
  ADD CONSTRAINT finanz_vermoegen_auto_ab_monat_fmt
  CHECK (auto_ab_monat IS NULL OR auto_ab_monat ~ '^[0-9]{4}-[0-9]{2}$');
