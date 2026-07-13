-- Persistenter Cache für EU-Fundamentalkennzahlen (Marketscreener).

CREATE TABLE IF NOT EXISTS public.eu_fundamental_cache (
  isin text NOT NULL,
  ticker text,
  firmenname text,
  cache_version integer NOT NULL,
  paket_json jsonb NOT NULL,
  quelle text,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (isin)
);

CREATE INDEX IF NOT EXISTS idx_eu_fundamental_cache_aktualisiert
  ON public.eu_fundamental_cache (aktualisiert_am DESC);

COMMENT ON TABLE public.eu_fundamental_cache IS
  'EU-Kennzahlen (Marketscreener) — Cache für Deployments/Server-IPs, damit die Struktur-Ansicht stabil bleibt.';

ALTER TABLE public.eu_fundamental_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eu_fundamental_cache FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eu_fundamental_cache FROM anon, PUBLIC, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eu_fundamental_cache TO service_role;

NOTIFY pgrst, 'reload schema';

