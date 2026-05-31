-- Speisekammer im Grocy-Stil:
--   * mhd            = nächstes Mindesthaltbarkeitsdatum (Ablauf-Ampel "bald / abgelaufen")
--   * mindestbestand = gewünschter Mindestvorrat in Basiseinheit (kg/Liter/Stück)
--                      → "Nachkaufen", sobald aktueller Bestand darunter liegt.
-- Beide optional (NULL = nicht gepflegt). RLS für public.produkte besteht bereits.
ALTER TABLE public.produkte ADD COLUMN IF NOT EXISTS mhd date;
ALTER TABLE public.produkte ADD COLUMN IF NOT EXISTS mindestbestand numeric(12,3);

COMMENT ON COLUMN public.produkte.mhd IS 'Nächstes Mindesthaltbarkeitsdatum (für Ablauf-Übersicht). NULL = nicht gepflegt.';
COMMENT ON COLUMN public.produkte.mindestbestand IS 'Mindestvorrat in Basiseinheit; darunter → Nachkauf-Vorschlag. NULL = aus.';
