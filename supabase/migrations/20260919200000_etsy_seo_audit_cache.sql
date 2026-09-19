-- Etsy SEO-Überwachung: Audit-Cache, Score-Historie, Rank-Cache

CREATE TABLE IF NOT EXISTS public.etsy_seo_audit_cache (
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  fingerprint text NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  audit_json jsonb NOT NULL,
  listing_title text NOT NULL DEFAULT '',
  state text,
  audited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_etsy_seo_audit_cache_score
  ON public.etsy_seo_audit_cache (owner_user_id, overall_score ASC);

CREATE TABLE IF NOT EXISTS public.etsy_seo_audit_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  fingerprint text,
  audit_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etsy_seo_audit_historie_listing
  ON public.etsy_seo_audit_historie (owner_user_id, listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.etsy_seo_rank_cache (
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  keyword text NOT NULL,
  page integer,
  position integer,
  found boolean NOT NULL DEFAULT false,
  note text,
  provider text NOT NULL DEFAULT 'etsy_search',
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, listing_id, keyword)
);

ALTER TABLE public.etsy_seo_audit_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_audit_cache FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_audit_historie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_audit_historie FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_rank_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_rank_cache FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_seo_audit_cache FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_seo_audit_historie FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_seo_rank_cache FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_seo_audit_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_seo_audit_historie TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_seo_rank_cache TO authenticated;

CREATE POLICY etsy_seo_audit_cache_owner ON public.etsy_seo_audit_cache
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_seo_audit_historie_owner ON public.etsy_seo_audit_historie
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_seo_rank_cache_owner ON public.etsy_seo_rank_cache
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
