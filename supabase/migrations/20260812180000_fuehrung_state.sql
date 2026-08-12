-- Führung: gesamter Client-State (Mitarbeiter, Tage, Notizen, …) pro Nutzer in der Cloud.
-- localStorage bleibt Offline-Cache; Sync über /api/fuehrung/sync.

CREATE TABLE IF NOT EXISTS public.fuehrung_state (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fuehrung_state IS
  'Führungspfad-State (JSON-Blob) — Sync zwischen Geräten; Quelle der Wahrheit neben localStorage.';

CREATE INDEX IF NOT EXISTS fuehrung_state_aktualisiert_am_idx
  ON public.fuehrung_state (aktualisiert_am DESC);

ALTER TABLE public.fuehrung_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuehrung_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fuehrung_state_owner_all ON public.fuehrung_state;
CREATE POLICY fuehrung_state_owner_all
  ON public.fuehrung_state
  FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- API nutzt Service Role (wie andere Sync-Routen); Anon hat keinen Direktzugriff.
REVOKE ALL ON TABLE public.fuehrung_state FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fuehrung_state TO authenticated;
GRANT ALL ON TABLE public.fuehrung_state TO service_role;

NOTIFY pgrst, 'reload schema';
