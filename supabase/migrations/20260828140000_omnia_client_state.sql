-- Geräteübergreifender Client-State (Nav, Theme, Modeberater, Einkaufsliste, …).
-- localStorage bleibt Offline-Cache; Sync über /api/client-state/sync.
-- Letzter Schreibzeitpunkt gewinnt pro Schlüssel (kein Union-Merge, damit Löschen hält).

CREATE TABLE IF NOT EXISTS public.omnia_client_state (
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  schluessel text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, schluessel)
);

COMMENT ON TABLE public.omnia_client_state IS
  'JSON-Blobs für Browser-State (Laptop ↔ Handy). Quelle der Wahrheit neben localStorage.';

CREATE INDEX IF NOT EXISTS omnia_client_state_aktualisiert_am_idx
  ON public.omnia_client_state (owner_user_id, aktualisiert_am DESC);

ALTER TABLE public.omnia_client_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnia_client_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS omnia_client_state_owner_all ON public.omnia_client_state;
CREATE POLICY omnia_client_state_owner_all
  ON public.omnia_client_state
  FOR ALL
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

REVOKE ALL ON TABLE public.omnia_client_state FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.omnia_client_state TO authenticated;
GRANT ALL ON TABLE public.omnia_client_state TO service_role;

NOTIFY pgrst, 'reload schema';
