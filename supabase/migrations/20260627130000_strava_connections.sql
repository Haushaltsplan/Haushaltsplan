-- Strava Multi-Athlet: Verbindungen (eigener Account + bis zu 3 Freunde)

CREATE TABLE IF NOT EXISTS public.strava_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Ich',
  is_primary boolean NOT NULL DEFAULT false,
  strava_athlete_id bigint,
  access_token text,
  refresh_token text,
  expires_at_ms bigint,
  firstname text,
  lastname text,
  ftp double precision,
  max_hr integer,
  omnia_weight_kg double precision,
  goal_km_year double precision,
  goal_hm_year double precision,
  goal_rides_per_week integer,
  goal_event_name text,
  goal_event_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strava_connections_manager_athlete UNIQUE (manager_user_id, strava_athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_strava_connections_manager
  ON public.strava_connections (manager_user_id, is_primary DESC, created_at);

ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.strava_connections (id) ON DELETE CASCADE;

ALTER TABLE public.strava_oauth_pending
  ADD COLUMN IF NOT EXISTS link_mode text NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS guest_label text;

-- Bestehende OAuth-Daten → primäre Verbindung
INSERT INTO public.strava_connections (
  manager_user_id,
  label,
  is_primary,
  strava_athlete_id,
  access_token,
  refresh_token,
  expires_at_ms,
  firstname,
  lastname,
  ftp,
  max_hr,
  omnia_weight_kg,
  goal_km_year,
  goal_hm_year,
  goal_rides_per_week,
  goal_event_name,
  goal_event_date,
  updated_at
)
SELECT
  t.owner_user_id,
  COALESCE(NULLIF(TRIM(CONCAT(p.firstname, ' ', p.lastname)), ''), 'Ich'),
  true,
  t.athlete_id,
  t.access_token,
  t.refresh_token,
  t.expires_at_ms,
  p.firstname,
  p.lastname,
  p.ftp,
  p.max_hr,
  p.omnia_weight_kg,
  p.goal_km_year,
  p.goal_hm_year,
  p.goal_rides_per_week,
  p.goal_event_name,
  p.goal_event_date,
  GREATEST(t.updated_at, COALESCE(p.updated_at, t.updated_at))
FROM public.strava_oauth_tokens t
LEFT JOIN public.strava_athlete_profile p ON p.owner_user_id = t.owner_user_id
ON CONFLICT (manager_user_id, strava_athlete_id) DO NOTHING;

-- Aktivitäten der primären Verbindung zuordnen
UPDATE public.strava_activities a
SET connection_id = c.id
FROM public.strava_connections c
WHERE a.connection_id IS NULL
  AND c.manager_user_id = a.owner_user_id
  AND c.is_primary = true;

-- Fallback: erste Verbindung pro Manager
UPDATE public.strava_activities a
SET connection_id = c.id
FROM (
  SELECT DISTINCT ON (manager_user_id) id, manager_user_id
  FROM public.strava_connections
  ORDER BY manager_user_id, is_primary DESC, created_at
) c
WHERE a.connection_id IS NULL
  AND c.manager_user_id = a.owner_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS strava_activities_connection_strava
  ON public.strava_activities (connection_id, strava_id)
  WHERE connection_id IS NOT NULL;

ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_connections FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.strava_connections FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strava_connections TO authenticated;

CREATE POLICY strava_connections_manager ON public.strava_connections
  FOR ALL TO authenticated
  USING (manager_user_id = auth.uid())
  WITH CHECK (manager_user_id = auth.uid());

-- Aktivitäten: Zugriff über Verbindung des Managers
DROP POLICY IF EXISTS strava_activities_owner ON public.strava_activities;

CREATE POLICY strava_activities_manager ON public.strava_activities
  FOR ALL TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR connection_id IN (
      SELECT id FROM public.strava_connections WHERE manager_user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      connection_id IS NULL
      OR connection_id IN (
        SELECT id FROM public.strava_connections WHERE manager_user_id = auth.uid()
      )
    )
  );
