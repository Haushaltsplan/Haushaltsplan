-- =============================================================================
-- Haushaltsplan / Lager — EINMALIG in Supabase ausführen (SQL Editor → Run)
-- Behebt: "Could not find the table 'public.lager_einkauf' in the schema cache"
-- Oder lokal: npm run db:lager  (mit DATABASE_URL in .env.local)
-- =============================================================================

BEGIN;

-- Stamm (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.produkte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  einheit text NOT NULL DEFAULT 'Stück'
);

CREATE TABLE IF NOT EXISTS public.lagerbestand (
  produkt_id uuid PRIMARY KEY REFERENCES public.produkte (id) ON DELETE CASCADE,
  aktuelle_menge numeric NOT NULL DEFAULT 0 CHECK (aktuelle_menge >= 0)
);

CREATE TABLE IF NOT EXISTS public.lager_einkauf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES public.produkte (id) ON DELETE CASCADE,
  menge numeric NOT NULL CHECK (menge > 0),
  gesamtpreis numeric NOT NULL CHECK (gesamtpreis >= 0),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  quelle text NOT NULL DEFAULT 'kassenzettel_ki'
);

CREATE INDEX IF NOT EXISTS idx_lager_einkauf_produkt ON public.lager_einkauf (produkt_id);

COMMENT ON TABLE public.lager_einkauf IS 'Einkaufszeilen; Ø-Preis = Summe(gesamtpreis) / Summe(menge)';

CREATE TABLE IF NOT EXISTS public.lager_verbrauch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES public.produkte (id) ON DELETE CASCADE,
  menge numeric NOT NULL CHECK (menge > 0),
  notiz text,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  quelle text NOT NULL DEFAULT 'manuell'
);

CREATE INDEX IF NOT EXISTS idx_lager_verbrauch_produkt ON public.lager_verbrauch (produkt_id);

-- --- Row Level Security: Lager-Einkauf ---
ALTER TABLE public.lager_einkauf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lager_einkauf_select_anon" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_select_anon" ON public.lager_einkauf FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lager_einkauf_select_authenticated" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_select_authenticated" ON public.lager_einkauf FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lager_einkauf_insert_anon" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_insert_anon" ON public.lager_einkauf FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "lager_einkauf_insert_authenticated" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_insert_authenticated" ON public.lager_einkauf FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lager_einkauf_update_anon" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_update_anon" ON public.lager_einkauf FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_einkauf_update_authenticated" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_update_authenticated" ON public.lager_einkauf FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- --- Row Level Security: Verbrauch (Lesen; Schreiben über Service Role) ---
ALTER TABLE public.lager_verbrauch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lager_verbrauch_select_anon" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_select_anon" ON public.lager_verbrauch FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lager_verbrauch_select_authenticated" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_select_authenticated" ON public.lager_verbrauch FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lager_verbrauch_update_anon" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_update_anon" ON public.lager_verbrauch FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lager_verbrauch_update_authenticated" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_update_authenticated" ON public.lager_verbrauch FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- --- produkte: Anon-Zugriff (persönliche App; bei öffentlichem Deploy Auth + restriktive Policies) ---
ALTER TABLE public.produkte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produkte_select_anon" ON public.produkte;
CREATE POLICY "produkte_select_anon" ON public.produkte FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "produkte_insert_anon" ON public.produkte;
CREATE POLICY "produkte_insert_anon" ON public.produkte FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "produkte_update_anon" ON public.produkte;
CREATE POLICY "produkte_update_anon" ON public.produkte FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "produkte_delete_anon" ON public.produkte;
CREATE POLICY "produkte_delete_anon" ON public.produkte FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "produkte_select_authenticated" ON public.produkte;
CREATE POLICY "produkte_select_authenticated" ON public.produkte FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "produkte_insert_authenticated" ON public.produkte;
CREATE POLICY "produkte_insert_authenticated" ON public.produkte FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "produkte_update_authenticated" ON public.produkte;
CREATE POLICY "produkte_update_authenticated" ON public.produkte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "produkte_delete_authenticated" ON public.produkte;
CREATE POLICY "produkte_delete_authenticated" ON public.produkte FOR DELETE TO authenticated USING (true);

-- --- lagerbestand: Anon (Bestand lesen & setzen ohne Service Role) ---
ALTER TABLE public.lagerbestand ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lagerbestand_select_anon" ON public.lagerbestand;
CREATE POLICY "lagerbestand_select_anon" ON public.lagerbestand FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lagerbestand_insert_anon" ON public.lagerbestand;
CREATE POLICY "lagerbestand_insert_anon" ON public.lagerbestand FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "lagerbestand_update_anon" ON public.lagerbestand;
CREATE POLICY "lagerbestand_update_anon" ON public.lagerbestand FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lagerbestand_delete_anon" ON public.lagerbestand;
CREATE POLICY "lagerbestand_delete_anon" ON public.lagerbestand FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "lagerbestand_select_authenticated" ON public.lagerbestand;
CREATE POLICY "lagerbestand_select_authenticated" ON public.lagerbestand FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lagerbestand_insert_authenticated" ON public.lagerbestand;
CREATE POLICY "lagerbestand_insert_authenticated" ON public.lagerbestand FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lagerbestand_update_authenticated" ON public.lagerbestand;
CREATE POLICY "lagerbestand_update_authenticated" ON public.lagerbestand FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lagerbestand_delete_authenticated" ON public.lagerbestand;
CREATE POLICY "lagerbestand_delete_authenticated" ON public.lagerbestand FOR DELETE TO authenticated USING (true);

-- PostgREST: Schema-Cache neu laden (Supabase / PostgREST)
NOTIFY pgrst, 'reload schema';

COMMIT;
