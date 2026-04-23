-- Rezeptkatalog: Kategorie (Filter, KI).

ALTER TABLE public.lager_rezept_katalog
  ADD COLUMN IF NOT EXISTS kategorie text;

COMMENT ON COLUMN public.lager_rezept_katalog.kategorie IS 'z. B. Vegetarisch, Nudelgericht, Fleischgericht — für Filter; optional null.';
