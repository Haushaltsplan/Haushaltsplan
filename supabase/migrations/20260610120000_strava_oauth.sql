-- Strava OAuth + Aktivitäten (Rennrad-Seite)

CREATE TABLE IF NOT EXISTS public.strava_oauth_tokens (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at_ms bigint NOT NULL,
  athlete_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strava_oauth_pending (
  state text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.strava_athlete_profile (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  weight_kg double precision,
  ftp double precision,
  max_hr integer,
  firstname text,
  lastname text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.strava_activities (
  id bigserial PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  strava_id bigint NOT NULL,
  name text NOT NULL DEFAULT '',
  sport_type text NOT NULL DEFAULT 'Ride',
  type text,
  start_date timestamptz NOT NULL,
  distance_m double precision NOT NULL DEFAULT 0,
  moving_time_s integer NOT NULL DEFAULT 0,
  elapsed_time_s integer,
  elevation_gain_m double precision,
  average_watts double precision,
  weighted_avg_watts double precision,
  max_watts double precision,
  average_heartrate double precision,
  max_heartrate double precision,
  kilojoules double precision,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strava_activities_owner_strava UNIQUE (owner_user_id, strava_id)
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_owner_date
  ON public.strava_activities (owner_user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_strava_oauth_pending_expires ON public.strava_oauth_pending (expires_at);

ALTER TABLE public.strava_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_oauth_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.strava_oauth_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_oauth_pending FORCE ROW LEVEL SECURITY;
ALTER TABLE public.strava_athlete_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_athlete_profile FORCE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activities FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.strava_oauth_tokens FROM anon, PUBLIC;
REVOKE ALL ON public.strava_oauth_pending FROM anon, PUBLIC;
REVOKE ALL ON public.strava_athlete_profile FROM anon, PUBLIC;
REVOKE ALL ON public.strava_activities FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strava_oauth_tokens TO authenticated;
GRANT INSERT, DELETE ON public.strava_oauth_pending TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strava_athlete_profile TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strava_activities TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE strava_activities_id_seq TO authenticated;

CREATE POLICY strava_oauth_tokens_owner ON public.strava_oauth_tokens
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY strava_oauth_pending_owner_insert ON public.strava_oauth_pending
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY strava_oauth_pending_owner_delete ON public.strava_oauth_pending
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY strava_athlete_profile_owner ON public.strava_athlete_profile
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY strava_activities_owner ON public.strava_activities
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
