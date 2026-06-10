-- Omnia-Gewicht, Kalorien, Leistungs-Peaks (Streams)

ALTER TABLE public.strava_athlete_profile
  ADD COLUMN IF NOT EXISTS omnia_weight_kg double precision;

UPDATE public.strava_athlete_profile
SET omnia_weight_kg = weight_kg
WHERE omnia_weight_kg IS NULL AND weight_kg IS NOT NULL;

ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS calories_kcal double precision,
  ADD COLUMN IF NOT EXISTS average_speed_kmh double precision,
  ADD COLUMN IF NOT EXISTS device_watts boolean,
  ADD COLUMN IF NOT EXISTS power_peaks jsonb;

UPDATE public.strava_activities
SET calories_kcal = kilojoules / 4.184
WHERE calories_kcal IS NULL AND kilojoules IS NOT NULL AND kilojoules > 0;

UPDATE public.strava_activities
SET average_speed_kmh = (distance_m / NULLIF(moving_time_s, 0)) * 3.6
WHERE average_speed_kmh IS NULL AND moving_time_s > 0 AND distance_m > 0;
