-- Strava: Wetter pro Aktivität + optionales Wetter-Heimat + TSS-Wochenziel

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
