-- Fix finance page empty state caused by missing/overly strict RLS policies.
-- Applies only when the target tables exist.

DO $$
BEGIN
  IF to_regclass('public.einnahmen') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.einnahmen ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_select_anon" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_select_anon" ON public.einnahmen FOR SELECT TO anon USING (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_select_authenticated" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_select_authenticated" ON public.einnahmen FOR SELECT TO authenticated USING (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_insert_anon" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_insert_anon" ON public.einnahmen FOR INSERT TO anon WITH CHECK (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_insert_authenticated" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_insert_authenticated" ON public.einnahmen FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_update_anon" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_update_anon" ON public.einnahmen FOR UPDATE TO anon USING (auth.role() = ''anon'') WITH CHECK (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_update_authenticated" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_update_authenticated" ON public.einnahmen FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_delete_anon" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_delete_anon" ON public.einnahmen FOR DELETE TO anon USING (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "einnahmen_delete_authenticated" ON public.einnahmen';
    EXECUTE 'CREATE POLICY "einnahmen_delete_authenticated" ON public.einnahmen FOR DELETE TO authenticated USING (auth.role() = ''authenticated'')';
  END IF;

  IF to_regclass('public.ausgaben') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ausgaben ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_select_anon" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_select_anon" ON public.ausgaben FOR SELECT TO anon USING (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_select_authenticated" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_select_authenticated" ON public.ausgaben FOR SELECT TO authenticated USING (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_insert_anon" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_insert_anon" ON public.ausgaben FOR INSERT TO anon WITH CHECK (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_insert_authenticated" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_insert_authenticated" ON public.ausgaben FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_update_anon" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_update_anon" ON public.ausgaben FOR UPDATE TO anon USING (auth.role() = ''anon'') WITH CHECK (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_update_authenticated" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_update_authenticated" ON public.ausgaben FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_delete_anon" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_delete_anon" ON public.ausgaben FOR DELETE TO anon USING (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "ausgaben_delete_authenticated" ON public.ausgaben';
    EXECUTE 'CREATE POLICY "ausgaben_delete_authenticated" ON public.ausgaben FOR DELETE TO authenticated USING (auth.role() = ''authenticated'')';
  END IF;

  IF to_regclass('public.dauerauftraege') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.dauerauftraege ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_select_anon" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_select_anon" ON public.dauerauftraege FOR SELECT TO anon USING (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_select_authenticated" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_select_authenticated" ON public.dauerauftraege FOR SELECT TO authenticated USING (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_insert_anon" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_insert_anon" ON public.dauerauftraege FOR INSERT TO anon WITH CHECK (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_insert_authenticated" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_insert_authenticated" ON public.dauerauftraege FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_update_anon" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_update_anon" ON public.dauerauftraege FOR UPDATE TO anon USING (auth.role() = ''anon'') WITH CHECK (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_update_authenticated" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_update_authenticated" ON public.dauerauftraege FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_delete_anon" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_delete_anon" ON public.dauerauftraege FOR DELETE TO anon USING (auth.role() = ''anon'')';
    EXECUTE 'DROP POLICY IF EXISTS "dauerauftraege_delete_authenticated" ON public.dauerauftraege';
    EXECUTE 'CREATE POLICY "dauerauftraege_delete_authenticated" ON public.dauerauftraege FOR DELETE TO authenticated USING (auth.role() = ''authenticated'')';
  END IF;
END
$$;
