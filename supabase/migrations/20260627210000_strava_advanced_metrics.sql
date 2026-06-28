-- Strava: aerobe Dekoupling & Variability Index

ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS aerobic_decoupling_pct double precision,
  ADD COLUMN IF NOT EXISTS variability_index double precision;
