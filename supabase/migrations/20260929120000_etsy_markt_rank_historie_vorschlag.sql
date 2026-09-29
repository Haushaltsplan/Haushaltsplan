-- Etsy: Markt-Cache (Autosuggest/Konkurrenz, 24h), Rank-Historie, vorbereitete SEO-Vorschläge

-- Öffentliche Marktdaten, nicht nutzerbezogen — nur Service Role (keine Policies).
CREATE TABLE IF NOT EXISTS public.etsy_markt_cache (
  cache_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('suggest', 'competitor')),
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etsy_markt_cache_fetched
  ON public.etsy_markt_cache (fetched_at);

ALTER TABLE public.etsy_markt_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_markt_cache FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.etsy_markt_cache FROM anon, authenticated, PUBLIC;

-- etsy_seo_rank_cache = letzter Stand je Keyword; hier die Zeitreihe für Verlust-Erkennung.
CREATE TABLE IF NOT EXISTS public.etsy_seo_rank_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  keyword text NOT NULL,
  page integer,
  position integer,
  found boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'etsy_search',
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etsy_seo_rank_historie_listing
  ON public.etsy_seo_rank_historie (owner_user_id, listing_id, keyword, checked_at DESC);

-- Vom Cron vorbereitete Diffs, im UI mit 1 Klick übernehmen/verwerfen.
CREATE TABLE IF NOT EXISTS public.etsy_seo_vorschlag (
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'uebernommen', 'verworfen', 'veraltet')),
  grund text NOT NULL DEFAULT '',
  fingerprint text NOT NULL,
  listing_title text NOT NULL DEFAULT '',
  score_vorher integer CHECK (score_vorher IS NULL OR (score_vorher >= 0 AND score_vorher <= 100)),
  before_json jsonb NOT NULL,
  after_json jsonb NOT NULL,
  audit_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  entschieden_at timestamptz,
  PRIMARY KEY (owner_user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_etsy_seo_vorschlag_offen
  ON public.etsy_seo_vorschlag (owner_user_id, status, created_at DESC);

ALTER TABLE public.etsy_seo_rank_historie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_rank_historie FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_vorschlag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_vorschlag FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_seo_rank_historie FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_seo_vorschlag FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_seo_rank_historie TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_seo_vorschlag TO authenticated;

CREATE POLICY etsy_seo_rank_historie_owner ON public.etsy_seo_rank_historie
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_seo_vorschlag_owner ON public.etsy_seo_vorschlag
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
