-- Persistenter Cache für gescrapte Segment-/Geo-Struktur (Marketscreener + SA).

CREATE TABLE IF NOT EXISTS public.segment_struktur_cache (
  isin text NOT NULL,
  ticker text,
  firmenname text,
  cache_version integer NOT NULL,
  paket_json jsonb NOT NULL,
  quelle text,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (isin)
);

CREATE INDEX IF NOT EXISTS idx_segment_struktur_cache_aktualisiert
  ON public.segment_struktur_cache (aktualisiert_am DESC);

COMMENT ON TABLE public.segment_struktur_cache IS
  'Gescrapte Geschäftsstruktur (Produkt/Geo/Backlog) — Fallback wenn Live-Scrape auf Vercel fehlschlägt.';

ALTER TABLE public.segment_struktur_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_struktur_cache FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.segment_struktur_cache FROM anon, PUBLIC, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.segment_struktur_cache TO service_role;

NOTIFY pgrst, 'reload schema';
