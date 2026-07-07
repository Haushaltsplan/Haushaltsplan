-- Persistenter SEC-Segment-Cache (Produkt/Geo-Historie) — nur Service Role.
-- Inkrementell: neue 10-K-Accessions werden ergänzt, bestehende Daten bleiben.

CREATE TABLE IF NOT EXISTS public.sec_segment_historie_cache (
  ticker text NOT NULL,
  cik bigint NOT NULL,
  cache_version integer NOT NULL,
  verarbeitete_accessions text[] NOT NULL DEFAULT '{}',
  neueste_accession text,
  neuestes_bericht_jahr integer,
  roh_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  paket_json jsonb NOT NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker)
);

CREATE INDEX IF NOT EXISTS idx_sec_segment_historie_cache_aktualisiert
  ON public.sec_segment_historie_cache (aktualisiert_am DESC);

COMMENT ON TABLE public.sec_segment_historie_cache IS
  'SEC 10-K Segment-Historie (Produkt/Geo) — persistent, inkrementell um neue Filings ergänzt.';

ALTER TABLE public.sec_segment_historie_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sec_segment_historie_cache FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sec_segment_historie_cache FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
