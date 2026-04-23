-- Duplikat-Zusammenführung (UPDATE produkt_id) mit Anon-Key
DROP POLICY IF EXISTS "lager_einkauf_update_anon" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_update_anon" ON public.lager_einkauf FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_einkauf_update_authenticated" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_update_authenticated" ON public.lager_einkauf FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_verbrauch_update_anon" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_update_anon" ON public.lager_verbrauch FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_verbrauch_update_authenticated" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_update_authenticated" ON public.lager_verbrauch FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
