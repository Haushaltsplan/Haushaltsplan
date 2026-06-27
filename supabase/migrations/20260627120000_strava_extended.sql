-- Strava Extended: Polyline, Load, HR-Zonen, Ziele

ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS summary_polyline text,
  ADD COLUMN IF NOT EXISTS suffer_score double precision,
  ADD COLUMN IF NOT EXISTS gear_id bigint,
  ADD COLUMN IF NOT EXISTS workout_type integer,
  ADD COLUMN IF NOT EXISTS hr_zone_minutes jsonb,
  ADD COLUMN IF NOT EXISTS estimated_tss double precision;

ALTER TABLE public.strava_athlete_profile
  ADD COLUMN IF NOT EXISTS goal_km_year double precision,
  ADD COLUMN IF NOT EXISTS goal_hm_year double precision,
  ADD COLUMN IF NOT EXISTS goal_rides_per_week integer,
  ADD COLUMN IF NOT EXISTS goal_event_name text,
  ADD COLUMN IF NOT EXISTS goal_event_date date;
