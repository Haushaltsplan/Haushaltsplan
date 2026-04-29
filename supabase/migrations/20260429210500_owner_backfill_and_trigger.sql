-- Single-user comfort hardening:
-- - backfill missing owner_user_id with first auth user
-- - auto-fill owner_user_id on INSERT (also for service-role writes)

CREATE OR REPLACE FUNCTION public.app_owner_uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.ensure_owner_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := COALESCE(auth.uid(), public.app_owner_uid());
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  owner_id uuid;
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
  owner_id := public.app_owner_uid();

  FOREACH t IN ARRAY target_tables LOOP
    SELECT to_regclass(format('public.%I', t)) IS NOT NULL INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;

    IF owner_id IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET owner_user_id = $1 WHERE owner_user_id IS NULL', t) USING owner_id;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_ensure_owner_user_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_ensure_owner_user_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_user_id()',
      t
    );
  END LOOP;
END
$$;
