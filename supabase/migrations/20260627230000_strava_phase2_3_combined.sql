-- Strava Phase 2+3: Wetter, Advanced Metrics, Segmente (einmal in Supabase SQL Editor ausführen)
-- Enthält: 20260627200000, 20260627210000, 20260627220000

-- Wetter
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS weather_temp_c double precision,
  ADD COLUMN IF NOT EXISTS weather_wind_kmh double precision,
  ADD COLUMN IF NOT EXISTS weather_code integer,
  ADD COLUMN IF NOT EXISTS weather_lat double precision,
  ADD COLUMN IF NOT EXISTS weather_lon double precision;

ALTER TABLE public.strava_athlete_profile
  ADD COLUMN IF NOT EXISTS weather_home_lat double precision,
  ADD COLUMN IF NOT EXISTS weather_home_lon double precision,
  ADD COLUMN IF NOT EXISTS goal_tss_week double precision;

-- Advanced metrics
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS aerobic_decoupling_pct double precision,
  ADD COLUMN IF NOT EXISTS variability_index double precision;

-- Segmente
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS segments_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS public.strava_segment_efforts (
  id bigserial PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  strava_activity_id bigint NOT NULL,
  segment_id bigint NOT NULL,
  segment_name text NOT NULL DEFAULT '',
  elapsed_time_s integer,
  distance_m double precision,
  average_grade double precision,
  average_watts double precision,
  max_watts double precision,
  average_heartrate double precision,
  activity_start_date timestamptz NOT NULL,
  pr_rank integer,
  kom_rank integer,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strava_segment_efforts_unique UNIQUE (owner_user_id, strava_activity_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_strava_segment_efforts_owner_segment
  ON public.strava_segment_efforts (owner_user_id, segment_id, elapsed_time_s);

CREATE INDEX IF NOT EXISTS idx_strava_segment_efforts_owner_activity
  ON public.strava_segment_efforts (owner_user_id, strava_activity_id);

ALTER TABLE public.strava_segment_efforts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_segment_efforts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.strava_segment_efforts FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strava_segment_efforts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE strava_segment_efforts_id_seq TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strava_segment_efforts' AND policyname = 'strava_segment_efforts_owner'
  ) THEN
    CREATE POLICY strava_segment_efforts_owner ON public.strava_segment_efforts
      FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;
