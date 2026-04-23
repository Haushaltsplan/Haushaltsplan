-- Haushaltsplan-Kalender: eine gemeinsame Quelle pro Supabase-Projekt (analog zu besitz_*, gleicher Anon-Key in der App).
-- Synchronisation über die API des Nutzers: Laptop & Handy nutzen dieselbe .env/Online-Config.

CREATE TABLE IF NOT EXISTS public.haushalt_kalender_eintrag (
  id uuid PRIMARY KEY,
  datum date NOT NULL,
  titel text NOT NULL,
  notiz text NOT NULL DEFAULT '',
  uhrzeit text NOT NULL DEFAULT '',
  kategorie text NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_haushalt_kalender_datum ON public.haushalt_kalender_eintrag (datum);
CREATE INDEX IF NOT EXISTS idx_haushalt_kalender_aktualisiert ON public.haushalt_kalender_eintrag (aktualisiert_am DESC);

COMMENT ON TABLE public.haushalt_kalender_eintrag IS 'Kalendereinträge (Haushaltsplan) — Geräteübergreifend über Supabase, nicht nur localStorage.';

ALTER TABLE public.haushalt_kalender_eintrag ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "haushalt_kalender_select_anon" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_select_anon" ON public.haushalt_kalender_eintrag FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "haushalt_kalender_insert_anon" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_insert_anon" ON public.haushalt_kalender_eintrag FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "haushalt_kalender_update_anon" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_update_anon" ON public.haushalt_kalender_eintrag FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "haushalt_kalender_delete_anon" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_delete_anon" ON public.haushalt_kalender_eintrag FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "haushalt_kalender_select_auth" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_select_auth" ON public.haushalt_kalender_eintrag FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "haushalt_kalender_insert_auth" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_insert_auth" ON public.haushalt_kalender_eintrag FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "haushalt_kalender_update_auth" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_update_auth" ON public.haushalt_kalender_eintrag FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "haushalt_kalender_delete_auth" ON public.haushalt_kalender_eintrag;
CREATE POLICY "haushalt_kalender_delete_auth" ON public.haushalt_kalender_eintrag FOR DELETE TO authenticated USING (true);
