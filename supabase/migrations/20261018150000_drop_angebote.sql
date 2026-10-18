-- Angebote-Feature entfernt — Tabellen und Policies droppen

DROP POLICY IF EXISTS angebote_snapshot_owner ON public.angebote_snapshot;
DROP POLICY IF EXISTS angebote_einstellung_owner ON public.angebote_einstellung;

DROP INDEX IF EXISTS public.angebote_snapshot_owner_woche_idx;

DROP TABLE IF EXISTS public.angebote_snapshot;
DROP TABLE IF EXISTS public.angebote_einstellung;
