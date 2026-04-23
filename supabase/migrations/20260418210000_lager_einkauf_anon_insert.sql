-- Ermöglicht manuelles Anlegen / Fallback ohne Service Role (persönliche App).
-- Öffentlicher Deploy: enge Policies + Auth statt breitem anon-Zugriff.

DROP POLICY IF EXISTS "lager_einkauf_insert_anon" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_insert_anon" ON public.lager_einkauf FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "lager_einkauf_insert_authenticated" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_insert_authenticated" ON public.lager_einkauf FOR INSERT TO authenticated WITH CHECK (true);
