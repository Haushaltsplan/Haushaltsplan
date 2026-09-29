-- Etsy: gemerkte Keywords (Keyword-Explorer) und Hauptbegriff pro Listing

CREATE TABLE IF NOT EXISTS public.etsy_keyword_merkliste (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (char_length(keyword) BETWEEN 2 AND 80),
  nachfrage integer CHECK (nachfrage IS NULL OR (nachfrage >= 0 AND nachfrage <= 100)),
  wettbewerb integer,
  chance text CHECK (chance IS NULL OR chance IN ('hoch', 'mittel', 'niedrig')),
  quellen text[] NOT NULL DEFAULT '{}',
  saison text,
  notiz text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, keyword)
);

-- Der eine Suchbegriff, für den ein Listing ranken soll (eRank „Superstar Keyword“).
CREATE TABLE IF NOT EXISTS public.etsy_listing_hauptbegriff (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  hauptbegriff text NOT NULL CHECK (char_length(hauptbegriff) BETWEEN 2 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, listing_id)
);

ALTER TABLE public.etsy_keyword_merkliste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_keyword_merkliste FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_listing_hauptbegriff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_listing_hauptbegriff FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_keyword_merkliste FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_listing_hauptbegriff FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_keyword_merkliste TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_listing_hauptbegriff TO authenticated;

CREATE POLICY etsy_keyword_merkliste_owner ON public.etsy_keyword_merkliste
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_listing_hauptbegriff_owner ON public.etsy_listing_hauptbegriff
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
