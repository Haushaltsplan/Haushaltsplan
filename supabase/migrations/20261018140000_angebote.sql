-- Supermarkt-Angebotsvergleich: PLZ-Einstellungen + Wochen-Snapshots

CREATE TABLE IF NOT EXISTS public.angebote_einstellung (
  owner_user_id uuid PRIMARY KEY
    DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  plz text NOT NULL CHECK (plz ~ '^[0-9]{5}$'),
  markt_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  loyalty jsonb NOT NULL DEFAULT '[]'::jsonb,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.angebote_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL
    DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  plz text NOT NULL CHECK (plz ~ '^[0-9]{5}$'),
  woche text NOT NULL CHECK (char_length(woche) BETWEEN 7 AND 10),
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  quellen_status jsonb NOT NULL DEFAULT '[]'::jsonb,
  maerkte jsonb NOT NULL DEFAULT '[]'::jsonb,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, plz, woche)
);

CREATE INDEX IF NOT EXISTS angebote_snapshot_owner_woche_idx
  ON public.angebote_snapshot (owner_user_id, woche DESC);

ALTER TABLE public.angebote_einstellung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.angebote_einstellung FORCE ROW LEVEL SECURITY;
ALTER TABLE public.angebote_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.angebote_snapshot FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.angebote_einstellung FROM anon, PUBLIC;
REVOKE ALL ON public.angebote_snapshot FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.angebote_einstellung TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.angebote_snapshot TO authenticated;

CREATE POLICY angebote_einstellung_owner ON public.angebote_einstellung
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY angebote_snapshot_owner ON public.angebote_snapshot
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
