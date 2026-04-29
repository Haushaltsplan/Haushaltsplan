-- Hard privacy lockdown:
-- - remove anon access
-- - enforce per-user ownership with owner_user_id
-- - force RLS on all personal tables

DO $$
DECLARE
  t text;
  p record;
  seed_owner uuid;
  has_table boolean;
  null_owner_count bigint;
  target_tables text[] := ARRAY[
    'besitz_gegenstand',
    'finanz_rest_topf_meta',
    'finanz_rest_topf_monatsbuchung',
    'haushalt_kalender_eintrag',
    'lager_einkauf',
    'lager_rezept_katalog',
    'lagerbestand',
    'lagerverbrauch', -- safety typo-guard (ignored)
    'lager_verbrauch',
    'lager_mahlzeit',
    'produkte',
    'einnahmen',
    'ausgaben',
    'dauerauftraege'
  ];
BEGIN
  -- Best-effort backfill owner for existing rows (single-user bootstrap).
  SELECT id INTO seed_owner
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  FOREACH t IN ARRAY target_tables LOOP
    SELECT to_regclass(format('public.%I', t)) IS NOT NULL INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_user_id uuid', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_user_id SET DEFAULT auth.uid()', t);

    IF seed_owner IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET owner_user_id = $1 WHERE owner_user_id IS NULL', t) USING seed_owner;
    END IF;

    -- Remove existing policies to avoid accidental broad access.
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (owner_user_id = auth.uid())',
      t || '_owner_select',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid())',
      t || '_owner_insert',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid())',
      t || '_owner_update',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (owner_user_id = auth.uid())',
      t || '_owner_delete',
      t
    );
  END LOOP;

  -- Multi-user-safe keys for per-user finance buffer tables.
  IF to_regclass('public.finanz_rest_topf_meta') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.finanz_rest_topf_meta WHERE owner_user_id IS NULL' INTO null_owner_count;
    IF null_owner_count = 0 THEN
      EXECUTE 'ALTER TABLE public.finanz_rest_topf_meta DROP CONSTRAINT IF EXISTS finanz_rest_topf_meta_pkey';
      EXECUTE 'ALTER TABLE public.finanz_rest_topf_meta ADD CONSTRAINT finanz_rest_topf_meta_pkey PRIMARY KEY (owner_user_id, id)';
    END IF;
  END IF;

  IF to_regclass('public.finanz_rest_topf_monatsbuchung') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.finanz_rest_topf_monatsbuchung WHERE owner_user_id IS NULL' INTO null_owner_count;
    IF null_owner_count = 0 THEN
      EXECUTE 'ALTER TABLE public.finanz_rest_topf_monatsbuchung DROP CONSTRAINT IF EXISTS finanz_rest_topf_monatsbuchung_pkey';
      EXECUTE 'ALTER TABLE public.finanz_rest_topf_monatsbuchung ADD CONSTRAINT finanz_rest_topf_monatsbuchung_pkey PRIMARY KEY (owner_user_id, monat)';
    END IF;
  END IF;
END
$$;
