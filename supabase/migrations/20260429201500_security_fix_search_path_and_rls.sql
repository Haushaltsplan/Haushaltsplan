-- Security hardening for Supabase linter warnings:
-- - fix function_search_path_mutable
-- - replace always-true write RLS clauses with explicit role checks

-- ---------------------------------------------------------------------------
-- Functions: lock search_path
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.lager_nach_basis_umrechnen(numeric, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.lager_buche_mahlzeit(text, timestamptz, text, jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.lager_verbrauch_rueckgaengig(uuid)
  SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Besitz
-- ---------------------------------------------------------------------------
ALTER POLICY "besitz_gegenstand_insert_anon" ON public.besitz_gegenstand
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "besitz_gegenstand_insert_authenticated" ON public.besitz_gegenstand
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "besitz_gegenstand_update_anon" ON public.besitz_gegenstand
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "besitz_gegenstand_update_authenticated" ON public.besitz_gegenstand
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "besitz_gegenstand_delete_anon" ON public.besitz_gegenstand
  USING (auth.role() = 'anon');

ALTER POLICY "besitz_gegenstand_delete_authenticated" ON public.besitz_gegenstand
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Finanz Rest-Topf
-- ---------------------------------------------------------------------------
ALTER POLICY "finanz_rest_topf_meta_update_anon" ON public.finanz_rest_topf_meta
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "finanz_rest_topf_meta_update_auth" ON public.finanz_rest_topf_meta
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "finanz_rest_topf_monat_insert_anon" ON public.finanz_rest_topf_monatsbuchung
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "finanz_rest_topf_monat_insert_auth" ON public.finanz_rest_topf_monatsbuchung
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "finanz_rest_topf_monat_update_anon" ON public.finanz_rest_topf_monatsbuchung
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "finanz_rest_topf_monat_update_auth" ON public.finanz_rest_topf_monatsbuchung
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Kalender
-- ---------------------------------------------------------------------------
ALTER POLICY "haushalt_kalender_insert_anon" ON public.haushalt_kalender_eintrag
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "haushalt_kalender_insert_auth" ON public.haushalt_kalender_eintrag
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "haushalt_kalender_update_anon" ON public.haushalt_kalender_eintrag
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "haushalt_kalender_update_auth" ON public.haushalt_kalender_eintrag
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "haushalt_kalender_delete_anon" ON public.haushalt_kalender_eintrag
  USING (auth.role() = 'anon');

ALTER POLICY "haushalt_kalender_delete_auth" ON public.haushalt_kalender_eintrag
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Lager Einkauf / Bestand / Rezept
-- ---------------------------------------------------------------------------
ALTER POLICY "lager_einkauf_insert_anon" ON public.lager_einkauf
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "lager_einkauf_insert_authenticated" ON public.lager_einkauf
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "lagerbestand_insert_anon" ON public.lagerbestand
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "lagerbestand_insert_authenticated" ON public.lagerbestand
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "lagerbestand_update_anon" ON public.lagerbestand
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "lagerbestand_update_authenticated" ON public.lagerbestand
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "lagerbestand_delete_anon" ON public.lagerbestand
  USING (auth.role() = 'anon');

ALTER POLICY "lagerbestand_delete_authenticated" ON public.lagerbestand
  USING (auth.role() = 'authenticated');

ALTER POLICY "lager_rezept_katalog_insert_anon" ON public.lager_rezept_katalog
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "lager_rezept_katalog_insert_authenticated" ON public.lager_rezept_katalog
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "lager_rezept_katalog_update_anon" ON public.lager_rezept_katalog
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "lager_rezept_katalog_update_authenticated" ON public.lager_rezept_katalog
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "lager_rezept_katalog_delete_anon" ON public.lager_rezept_katalog
  USING (auth.role() = 'anon');

ALTER POLICY "lager_rezept_katalog_delete_authenticated" ON public.lager_rezept_katalog
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Produkte
-- ---------------------------------------------------------------------------
ALTER POLICY "produkte_insert_anon" ON public.produkte
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "produkte_insert_authenticated" ON public.produkte
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "produkte_update_anon" ON public.produkte
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

ALTER POLICY "produkte_update_authenticated" ON public.produkte
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "produkte_delete_anon" ON public.produkte
  USING (auth.role() = 'anon');

ALTER POLICY "produkte_delete_authenticated" ON public.produkte
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.produkte;
CREATE POLICY "Enable insert for authenticated users only"
  ON public.produkte
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');
