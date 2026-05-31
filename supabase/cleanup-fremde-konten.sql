-- ============================================================================
-- EINMALIGE BEREINIGUNG: Fremde Konten entfernen + ALLE Daten dir zuordnen
-- ----------------------------------------------------------------------------
-- Anlass: In auth.users sind fremde (Bot-)Konten aufgetaucht. Vorgehen:
--   1) Supabase → Authentication → Settings: "Allow new users to sign up" AUS.
--   2) DIESES Skript im Supabase SQL Editor ausführen (E-Mail unten eintragen).
--   3) Danach die Lockdown-Migration 20260531140000_privacy_hard_lockdown.sql ausführen.
--
-- Das Skript ist Single-User-Logik: ALLE Daten in den persönlichen Tabellen
-- werden DIR zugeordnet, und alle anderen Konten werden gelöscht.
-- ============================================================================

DO $$
DECLARE
  meine_email text := 'andreasmaier1507@gmail.com';  -- <== HIER deine echte Login-E-Mail eintragen
  meine_uid uuid;
  t text;
  geloescht bigint;
BEGIN
  SELECT id INTO meine_uid FROM auth.users WHERE lower(email) = lower(trim(meine_email));
  IF meine_uid IS NULL THEN
    RAISE EXCEPTION 'Kein Konto mit dieser E-Mail gefunden: %. Bitte exakte Login-E-Mail eintragen.', meine_email;
  END IF;

  -- 1) Alle persönlichen Tabellen DIR zuordnen (auch evtl. von Fremdkonten angelegte Zeilen).
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT IN ('investment_portfolio_flag', 'investment_portfolio_position')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_user_id uuid', t);
    EXECUTE format('UPDATE public.%I SET owner_user_id = $1', t) USING meine_uid;
  END LOOP;

  -- 2) Alle Konten außer deinem löschen (cascadet in auth-Schema: sessions, identities …).
  DELETE FROM auth.users WHERE id <> meine_uid;
  GET DIAGNOSTICS geloescht = ROW_COUNT;

  RAISE NOTICE 'Fertig: Alle Daten gehören jetzt % (%). Gelöschte Fremdkonten: %.', meine_email, meine_uid, geloescht;
END $$;
