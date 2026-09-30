-- Screener-Snapshot: Schema-Version persistent (kein Heuristik-Raten beim Laden).
ALTER TABLE public.screener_sec_snapshot
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;
