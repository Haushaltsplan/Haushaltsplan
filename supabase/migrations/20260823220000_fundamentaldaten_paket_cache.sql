-- Persistenter Fundamentaldaten-Cache: Scrape nur bei Veraltung oder geänderter GuV.
CREATE TABLE IF NOT EXISTS public.fundamentaldaten_paket_cache (
  cache_key       text PRIMARY KEY,
  isin            text,
  ticker          text,
  frequenz        text NOT NULL DEFAULT 'jahr',
  cache_version   integer NOT NULL,
  fingerprint     text NOT NULL,
  paket_json      jsonb NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fundamentaldaten_paket_cache_isin
  ON public.fundamentaldaten_paket_cache (isin);

CREATE INDEX IF NOT EXISTS fundamentaldaten_paket_cache_aktualisiert
  ON public.fundamentaldaten_paket_cache (aktualisiert_am DESC);

ALTER TABLE public.fundamentaldaten_paket_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamentaldaten_paket_cache FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fundamentaldaten_paket_cache FROM anon, PUBLIC, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fundamentaldaten_paket_cache TO service_role;
