-- Restore app behavior for single-user setup:
-- Re-enable anon + authenticated CRUD access on core tables.
-- This reverts the strict owner-only lockdown for the current app model.

DO $$
DECLARE
  t text;
  p record;
  has_table boolean;
  target_tables text[] := ARRAY[
    'besitz_gegenstand',
    'finanz_rest_topf_meta',
    'finanz_rest_topf_monatsbuchung',
    'haushalt_kalender_eintrag',
    'lager_einkauf',
    'lager_rezept_katalog',
    'lagerbestand',
    'lager_verbrauch',
    'lager_mahlzeit',
    'produkte',
    'einnahmen',
    'ausgaben',
    'dauerauftraege'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    SELECT to_regclass(format('public.%I', t)) IS NOT NULL INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;

    -- Remove restrictive policies (including owner-only policies).
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (auth.role() = ''anon'')',
      t || '_select_anon',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO anon WITH CHECK (auth.role() = ''anon'')',
      t || '_insert_anon',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO anon USING (auth.role() = ''anon'') WITH CHECK (auth.role() = ''anon'')',
      t || '_update_anon',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO anon USING (auth.role() = ''anon'')',
      t || '_delete_anon',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.role() = ''authenticated'')',
      t || '_select_authenticated',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.role() = ''authenticated'')',
      t || '_insert_authenticated',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      t || '_update_authenticated',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.role() = ''authenticated'')',
      t || '_delete_authenticated',
      t
    );
  END LOOP;
END
$$;
