-- Universum-Snapshot für den Aktienscreener (SEC Frames, Nasdaq/NYSE/CBOE).
CREATE TABLE IF NOT EXISTS public.screener_sec_snapshot (
  id              text PRIMARY KEY,
  periode         text NOT NULL,
  zeilen          jsonb NOT NULL,
  n               integer NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.screener_sec_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screener_sec_snapshot FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.screener_sec_snapshot FROM anon, PUBLIC, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.screener_sec_snapshot TO service_role;
