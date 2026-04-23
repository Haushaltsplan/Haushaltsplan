-- Persönliche Gegenstände (Kleidung, Schuhe, Elektronik, …) mit Einkaufspreis.

CREATE TABLE IF NOT EXISTS public.besitz_gegenstand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kategorie text NOT NULL,
  einkaufspreis_eur numeric NOT NULL CHECK (einkaufspreis_eur >= 0),
  einkaufsdatum date,
  haendler text,
  notiz text,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_besitz_gegenstand_kategorie ON public.besitz_gegenstand (kategorie);
CREATE INDEX IF NOT EXISTS idx_besitz_gegenstand_erstellt ON public.besitz_gegenstand (erstellt_am DESC);

COMMENT ON TABLE public.besitz_gegenstand IS 'Eigene Gegenstände mit Anschaffungspreis (nicht Speisekammer).';
COMMENT ON COLUMN public.besitz_gegenstand.einkaufspreis_eur IS 'Einkaufspreis in EUR (einmalig).';

ALTER TABLE public.besitz_gegenstand ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "besitz_gegenstand_select_anon" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_select_anon" ON public.besitz_gegenstand FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "besitz_gegenstand_insert_anon" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_insert_anon" ON public.besitz_gegenstand FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "besitz_gegenstand_update_anon" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_update_anon" ON public.besitz_gegenstand FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "besitz_gegenstand_delete_anon" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_delete_anon" ON public.besitz_gegenstand FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "besitz_gegenstand_select_authenticated" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_select_authenticated" ON public.besitz_gegenstand FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "besitz_gegenstand_insert_authenticated" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_insert_authenticated" ON public.besitz_gegenstand FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "besitz_gegenstand_update_authenticated" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_update_authenticated" ON public.besitz_gegenstand FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "besitz_gegenstand_delete_authenticated" ON public.besitz_gegenstand;
CREATE POLICY "besitz_gegenstand_delete_authenticated" ON public.besitz_gegenstand FOR DELETE TO authenticated USING (true);
