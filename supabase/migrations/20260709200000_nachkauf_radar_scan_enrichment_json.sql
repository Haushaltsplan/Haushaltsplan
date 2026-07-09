-- Nachkauf-Radar: Scan-Zusatzdaten als JSON persistieren (DB-Roundtrip ohne Datenverlust).

ALTER TABLE public.nachkauf_radar_scan
  ADD COLUMN IF NOT EXISTS daten_signale jsonb,
  ADD COLUMN IF NOT EXISTS score_detail jsonb,
  ADD COLUMN IF NOT EXISTS trim_signal jsonb;

COMMENT ON COLUMN public.nachkauf_radar_scan.daten_signale IS
  'Beat/Miss, Prognose, Struktur, Capital Allocation — NachkaufZusatzSignale';

COMMENT ON COLUMN public.nachkauf_radar_scan.score_detail IS
  'Vollständige Score-Zerlegung inkl. Klumpen/Sektor/Regime nach Finalisierung';

COMMENT ON COLUMN public.nachkauf_radar_scan.trim_signal IS
  'Regelbasiertes Trim-/Verkaufssignal nach berechneTrimSignale';

NOTIFY pgrst, 'reload schema';
