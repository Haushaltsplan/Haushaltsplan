-- Portfolioanalyse: personenbezogene Nachkauf-Tabellen je Konto trennen.
-- Nachkauf-Tabellen wurden service-role-only angelegt — owner_user_id fehlt oft.
-- Diese Datei ist idempotent: Spalte anlegen, Altdaten dem ersten Konto zuordnen, PK umstellen.

DO $$
DECLARE
  seed_owner uuid;
  t text;
BEGIN
  SELECT id INTO seed_owner FROM auth.users ORDER BY created_at ASC LIMIT 1;

  FOREACH t IN ARRAY ARRAY[
    'nachkauf_radar_scan',
    'nachkauf_radar_deep_research',
    'nachkauf_radar_watchlist',
    'nachkauf_radar_notizen',
    'nachkauf_radar_kaufhistorie_cache',
    'nachkauf_radar_scan_verlauf'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_user_id uuid', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_user_id SET DEFAULT auth.uid()', t);
    IF seed_owner IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET owner_user_id = $1 WHERE owner_user_id IS NULL', t)
        USING seed_owner;
    END IF;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- nachkauf_radar_scan
-- ---------------------------------------------------------------------------
ALTER TABLE public.nachkauf_radar_scan
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nachkauf_radar_scan'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%owner_user_id%'
  ) THEN
    ALTER TABLE public.nachkauf_radar_scan DROP CONSTRAINT IF EXISTS nachkauf_radar_scan_pkey;
    ALTER TABLE public.nachkauf_radar_scan ADD PRIMARY KEY (owner_user_id, ticker);
  END IF;
END
$$;

ALTER TABLE public.nachkauf_radar_scan DROP CONSTRAINT IF EXISTS nachkauf_radar_scan_owner_fk;
ALTER TABLE public.nachkauf_radar_scan
  ADD CONSTRAINT nachkauf_radar_scan_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS nachkauf_radar_scan_owner_idx
  ON public.nachkauf_radar_scan (owner_user_id);

-- ---------------------------------------------------------------------------
-- nachkauf_radar_deep_research
-- ---------------------------------------------------------------------------
ALTER TABLE public.nachkauf_radar_deep_research
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nachkauf_radar_deep_research'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%owner_user_id%'
  ) THEN
    ALTER TABLE public.nachkauf_radar_deep_research DROP CONSTRAINT IF EXISTS nachkauf_radar_deep_research_pkey;
    ALTER TABLE public.nachkauf_radar_deep_research ADD PRIMARY KEY (owner_user_id, ticker);
  END IF;
END
$$;

ALTER TABLE public.nachkauf_radar_deep_research DROP CONSTRAINT IF EXISTS nachkauf_radar_deep_research_owner_fk;
ALTER TABLE public.nachkauf_radar_deep_research
  ADD CONSTRAINT nachkauf_radar_deep_research_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- nachkauf_radar_watchlist
-- ---------------------------------------------------------------------------
ALTER TABLE public.nachkauf_radar_watchlist
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nachkauf_radar_watchlist'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%owner_user_id%'
  ) THEN
    ALTER TABLE public.nachkauf_radar_watchlist DROP CONSTRAINT IF EXISTS nachkauf_radar_watchlist_pkey;
    ALTER TABLE public.nachkauf_radar_watchlist ADD PRIMARY KEY (owner_user_id, isin);
  END IF;
END
$$;

ALTER TABLE public.nachkauf_radar_watchlist DROP CONSTRAINT IF EXISTS nachkauf_radar_watchlist_owner_fk;
ALTER TABLE public.nachkauf_radar_watchlist
  ADD CONSTRAINT nachkauf_radar_watchlist_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- nachkauf_radar_notizen
-- ---------------------------------------------------------------------------
ALTER TABLE public.nachkauf_radar_notizen
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nachkauf_radar_notizen'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%owner_user_id%'
  ) THEN
    ALTER TABLE public.nachkauf_radar_notizen DROP CONSTRAINT IF EXISTS nachkauf_radar_notizen_pkey;
    ALTER TABLE public.nachkauf_radar_notizen ADD PRIMARY KEY (owner_user_id, ticker);
  END IF;
END
$$;

ALTER TABLE public.nachkauf_radar_notizen DROP CONSTRAINT IF EXISTS nachkauf_radar_notizen_owner_fk;
ALTER TABLE public.nachkauf_radar_notizen
  ADD CONSTRAINT nachkauf_radar_notizen_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- nachkauf_radar_kaufhistorie_cache
-- ---------------------------------------------------------------------------
ALTER TABLE public.nachkauf_radar_kaufhistorie_cache
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.nachkauf_radar_kaufhistorie_cache'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) ILIKE '%owner_user_id%'
  ) THEN
    ALTER TABLE public.nachkauf_radar_kaufhistorie_cache DROP CONSTRAINT IF EXISTS nachkauf_radar_kaufhistorie_cache_pkey;
    ALTER TABLE public.nachkauf_radar_kaufhistorie_cache ADD PRIMARY KEY (owner_user_id, ticker);
  END IF;
END
$$;

ALTER TABLE public.nachkauf_radar_kaufhistorie_cache DROP CONSTRAINT IF EXISTS nachkauf_radar_kaufhistorie_cache_owner_fk;
ALTER TABLE public.nachkauf_radar_kaufhistorie_cache
  ADD CONSTRAINT nachkauf_radar_kaufhistorie_cache_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- nachkauf_radar_scan_verlauf — Unique je Owner + Ticker + Tag
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS nachkauf_radar_verlauf_ticker_scan_datum_uidx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nachkauf_radar_scan_verlauf'
      AND column_name = 'scan_datum'
  ) THEN
    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS nachkauf_radar_verlauf_owner_ticker_scan_datum_uidx
        ON public.nachkauf_radar_scan_verlauf (owner_user_id, ticker, scan_datum)
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS nachkauf_radar_verlauf_owner_ticker_gescannt_uidx
        ON public.nachkauf_radar_scan_verlauf (owner_user_id, ticker, gescannt_am)
    $sql$;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS nachkauf_radar_verlauf_owner_idx
  ON public.nachkauf_radar_scan_verlauf (owner_user_id, gescannt_am DESC);

ALTER TABLE public.nachkauf_radar_scan_verlauf DROP CONSTRAINT IF EXISTS nachkauf_radar_scan_verlauf_owner_fk;
ALTER TABLE public.nachkauf_radar_scan_verlauf
  ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE public.nachkauf_radar_scan_verlauf
  ADD CONSTRAINT nachkauf_radar_scan_verlauf_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- Buchungen / Snapshot / Kaufempfehlung / Tracking: mit dem Konto löschen
DO $$
BEGIN
  IF to_regclass('public.portfolio_analyse_buchung') IS NOT NULL THEN
    ALTER TABLE public.portfolio_analyse_buchung DROP CONSTRAINT IF EXISTS portfolio_analyse_buchung_owner_fk;
    ALTER TABLE public.portfolio_analyse_buchung
      ADD CONSTRAINT portfolio_analyse_buchung_owner_fk
      FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.portfolio_analyse_snapshot') IS NOT NULL THEN
    ALTER TABLE public.portfolio_analyse_snapshot DROP CONSTRAINT IF EXISTS portfolio_analyse_snapshot_owner_fk;
    ALTER TABLE public.portfolio_analyse_snapshot
      ADD CONSTRAINT portfolio_analyse_snapshot_owner_fk
      FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.nachkauf_kaufempfehlung') IS NOT NULL THEN
    ALTER TABLE public.nachkauf_kaufempfehlung DROP CONSTRAINT IF EXISTS nachkauf_kaufempfehlung_owner_fk;
    ALTER TABLE public.nachkauf_kaufempfehlung
      ADD CONSTRAINT nachkauf_kaufempfehlung_owner_fk
      FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.nachkauf_empfehlung_tracking') IS NOT NULL THEN
    ALTER TABLE public.nachkauf_empfehlung_tracking DROP CONSTRAINT IF EXISTS nachkauf_empfehlung_tracking_owner_fk;
    ALTER TABLE public.nachkauf_empfehlung_tracking
      ADD CONSTRAINT nachkauf_empfehlung_tracking_owner_fk
      FOREIGN KEY (owner_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
