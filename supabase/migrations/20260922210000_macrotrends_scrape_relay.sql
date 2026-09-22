-- Heim-Relay für Macrotrends-Scrapes (öffentliche App → Chrome am PC).
CREATE TABLE IF NOT EXISTS public.macrotrends_scrape_relay (
  id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_url        text NOT NULL,
  secret_hash     text NOT NULL,
  secret_plain    text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.macrotrends_scrape_relay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macrotrends_scrape_relay FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.macrotrends_scrape_relay FROM anon, PUBLIC, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.macrotrends_scrape_relay TO service_role;
