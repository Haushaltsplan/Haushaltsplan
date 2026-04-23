-- Gespeicherte KI-Rezepte: Katalog, Bewertung 1–10, geschätzte kcal (gesamt).

CREATE TABLE IF NOT EXISTS public.lager_rezept_katalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  portionen numeric NOT NULL CHECK (portionen > 0),
  gericht_json jsonb NOT NULL,
  geschaetzte_kcal_gesamt integer CHECK (
    geschaetzte_kcal_gesamt IS NULL OR (geschaetzte_kcal_gesamt > 0 AND geschaetzte_kcal_gesamt < 100000)
  ),
  bewertung smallint CHECK (bewertung IS NULL OR (bewertung >= 1 AND bewertung <= 10)),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lager_rezept_katalog_erstellt ON public.lager_rezept_katalog (erstellt_am DESC);

COMMENT ON TABLE public.lager_rezept_katalog IS 'Vom Nutzer gespeicherte KI-Rezepte; bewertung 1–10; kcal grobe Schätzung fürs Gesamtgericht.';
COMMENT ON COLUMN public.lager_rezept_katalog.gericht_json IS 'Struktur wie RezeptGericht (titel, portionen, zutaten, kochschritte, optional geschaetzte_kcal_gesamt).';
COMMENT ON COLUMN public.lager_rezept_katalog.geschaetzte_kcal_gesamt IS 'Kilokalorien fürs gesamte Gericht (alle Portionen), unverbindliche Schätzung.';

ALTER TABLE public.lager_rezept_katalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lager_rezept_katalog_select_anon" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_select_anon" ON public.lager_rezept_katalog FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_insert_anon" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_insert_anon" ON public.lager_rezept_katalog FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_update_anon" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_update_anon" ON public.lager_rezept_katalog FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_delete_anon" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_delete_anon" ON public.lager_rezept_katalog FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_select_authenticated" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_select_authenticated" ON public.lager_rezept_katalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_insert_authenticated" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_insert_authenticated" ON public.lager_rezept_katalog FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_update_authenticated" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_update_authenticated" ON public.lager_rezept_katalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_rezept_katalog_delete_authenticated" ON public.lager_rezept_katalog;
CREATE POLICY "lager_rezept_katalog_delete_authenticated" ON public.lager_rezept_katalog FOR DELETE TO authenticated USING (true);
