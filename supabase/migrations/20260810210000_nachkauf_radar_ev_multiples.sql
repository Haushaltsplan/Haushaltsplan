-- Historische EV-Multiples im Nachkauf-Radar (Scan-Persistenz)
ALTER TABLE nachkauf_radar_scan
  ADD COLUMN IF NOT EXISTS ntm_ev_ebitda real,
  ADD COLUMN IF NOT EXISTS ntm_ev_rev real,
  ADD COLUMN IF NOT EXISTS historischer_median_ev_ebitda real,
  ADD COLUMN IF NOT EXISTS historischer_median_ev_rev real,
  ADD COLUMN IF NOT EXISTS ev_ebitda_perzentil_5y real;
