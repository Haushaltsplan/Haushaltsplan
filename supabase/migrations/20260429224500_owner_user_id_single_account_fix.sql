-- Ein-Haushalt-Fix: Alle Zeilen mit owner_user_id auf den/die einzige(n)
-- Auth-Nutzer ausrichten. Behebt leere Finanzen/Speisekammer nach Login,
-- wenn RLS nur owner_user_id = auth.uid() erlaubt, die Daten aber einer
-- anderen UUID oder NULL zugeordnet sind.
--
-- Nur sinnvoll, wenn genau EIN Nutzer in auth.users existiert.
-- Bei mehreren Konten lieber manuell zuordnen.

DO $$
DECLARE
  uid uuid;
  user_count bigint;
  t text;
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
  has_table boolean;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;

  IF user_count = 0 THEN
    RAISE NOTICE 'owner_user_id fix skipped: auth.users is empty';
    RETURN;
  END IF;

  IF user_count > 1 THEN
    RAISE NOTICE 'owner_user_id fix skipped: multiple auth.users (%); assign manually if needed.', user_count;
    RETURN;
  END IF;

  SELECT id INTO uid FROM auth.users LIMIT 1;

  FOREACH t IN ARRAY target_tables LOOP
    SELECT to_regclass(format('public.%I', t)) IS NOT NULL INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET owner_user_id = $1 WHERE owner_user_id IS DISTINCT FROM $1 OR owner_user_id IS NULL',
      t
    ) USING uid;
  END LOOP;

  RAISE NOTICE 'owner_user_id aligned to single user %', uid;
END
$$;
