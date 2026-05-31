-- ============================================================================
-- PRIVATSPHÄRE: HARTE ABRIEGELUNG (Single-User)
-- ----------------------------------------------------------------------------
-- Ziel: Niemand außer dem angemeldeten Eigentümer kommt an die Daten.
--   * Entzieht dem öffentlichen anon-Schlüssel JEDEN Zugriff (anon + PUBLIC).
--   * Aktiviert + ERZWINGT Row Level Security auf allen persönlichen Tabellen.
--   * Erlaubt Zugriff nur für owner_user_id = auth.uid() (rolle: authenticated).
--   * Füllt owner_user_id für Altdaten auf den einzigen Nutzer (Single-User).
--
-- Dynamisch über alle Tabellen in public, damit auch zukünftige/unbekannte
-- Tabellen automatisch geschützt sind. Ausgenommen ist nur die (unkritische)
-- Investment-Watchlist, die serverseitig ohne Login gerendert wird.
-- ============================================================================

DO $$
DECLARE
  r record;
  p record;
  seed_owner uuid;
  user_count bigint;
  -- Nicht-personenbezogene Tabellen, die serverseitig ohne Session gelesen werden:
  ausnahmen text[] := ARRAY[
    'investment_portfolio_flag',
    'investment_portfolio_position'
  ];
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  SELECT id INTO seed_owner FROM auth.users ORDER BY created_at ASC LIMIT 1;

  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY(ausnahmen))
  LOOP
    -- Eigentümerspalte sicherstellen + Default auf den angemeldeten Nutzer.
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_user_id uuid', r.t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_user_id SET DEFAULT auth.uid()', r.t);

    -- Altdaten dem einzigen Nutzer zuordnen (nur bei genau einem Konto).
    IF user_count = 1 AND seed_owner IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET owner_user_id = $1 WHERE owner_user_id IS NULL', r.t) USING seed_owner;
    END IF;

    -- Bestehende Policies entfernen (sauberer Neuaufbau, keine Restzugänge).
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = r.t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, r.t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.t);

    -- anon (öffentlicher Browser-Key) und PUBLIC bekommen GAR KEINEN Zugriff.
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', r.t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (owner_user_id = auth.uid())',
      r.t || '_owner_select', r.t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid())',
      r.t || '_owner_insert', r.t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid())',
      r.t || '_owner_update', r.t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (owner_user_id = auth.uid())',
      r.t || '_owner_delete', r.t
    );
  END LOOP;
END
$$;
