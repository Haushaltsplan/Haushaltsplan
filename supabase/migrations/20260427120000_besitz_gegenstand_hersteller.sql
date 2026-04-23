-- Hersteller/Marke zu Besitz-Gegenständen (z. B. Nike, Samsung).

ALTER TABLE public.besitz_gegenstand
  ADD COLUMN IF NOT EXISTS hersteller text;

COMMENT ON COLUMN public.besitz_gegenstand.hersteller IS 'Hersteller oder Marke (optional).';
