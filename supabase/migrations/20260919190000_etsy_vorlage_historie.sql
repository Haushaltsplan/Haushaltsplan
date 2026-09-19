-- Etsy KI Agent: Vorlagen (Defaults) + Draft-Historie

CREATE TABLE IF NOT EXISTS public.etsy_listing_vorlage (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  shipping_profile_id bigint,
  readiness_state_id bigint,
  taxonomy_id bigint,
  standort_text text NOT NULL DEFAULT 'Niederbayern',
  finish_text text NOT NULL DEFAULT '2x lebensmittelechtes Walnussöl (natürlicher Schutz, mattglänzend)',
  who_made text NOT NULL DEFAULT 'i_did',
  when_made text NOT NULL DEFAULT 'made_to_order',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.etsy_draft_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  shop_id bigint NOT NULL,
  title text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  preis_min_eur integer,
  preis_empfohlen_eur integer,
  preis_max_eur integer,
  preis_verwendet_eur integer NOT NULL,
  taxonomy_id bigint,
  holzart text,
  listing_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etsy_draft_historie_owner_created
  ON public.etsy_draft_historie (owner_user_id, created_at DESC);

ALTER TABLE public.etsy_listing_vorlage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_listing_vorlage FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_draft_historie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_draft_historie FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_listing_vorlage FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_draft_historie FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_listing_vorlage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_draft_historie TO authenticated;

CREATE POLICY etsy_listing_vorlage_owner ON public.etsy_listing_vorlage
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_draft_historie_owner ON public.etsy_draft_historie
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
