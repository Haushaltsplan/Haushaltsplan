-- Etsy-Cockpit: tägliche Listing-Statistik, Verkäufe, Änderungs-Log (Wirkungsmessung),
-- Aufgaben-Status (ausblenden/erledigt) und Top-Tags der Konkurrenz.

-- Etsy liefert views/num_favorers als Lebenszeit-Zähler → Tagesdifferenz = Aufrufe/Favoriten am Tag.
CREATE TABLE IF NOT EXISTS public.etsy_listing_statistik (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  tag date NOT NULL,
  views integer,
  favoriten integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, listing_id, tag)
);

CREATE INDEX IF NOT EXISTS etsy_listing_statistik_tag_idx
  ON public.etsy_listing_statistik (owner_user_id, tag);

-- Einzelne Verkäufe (Etsy-Transaktionen, Scope transactions_r).
CREATE TABLE IF NOT EXISTS public.etsy_listing_verkauf (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  transaction_id bigint NOT NULL,
  listing_id bigint,
  menge integer NOT NULL DEFAULT 1,
  preis_eur numeric(10, 2),
  verkauft_at timestamptz NOT NULL,
  PRIMARY KEY (owner_user_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS etsy_listing_verkauf_zeit_idx
  ON public.etsy_listing_verkauf (owner_user_id, verkauft_at DESC);

-- Jede über das Tool auf Etsy geschriebene Änderung → Vorher/Nachher-Wirkung.
CREATE TABLE IF NOT EXISTS public.etsy_seo_aenderung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  listing_title text NOT NULL DEFAULT '',
  quelle text NOT NULL CHECK (quelle IN ('vorschlag', 'aufgabe', 'manuell')),
  beschreibung text NOT NULL DEFAULT '',
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etsy_seo_aenderung_zeit_idx
  ON public.etsy_seo_aenderung (owner_user_id, created_at DESC);

-- Vom Nutzer ausgeblendete/erledigte Cockpit-Aufgaben (Schlüssel = stabiler Aufgaben-Key).
CREATE TABLE IF NOT EXISTS public.etsy_aufgabe_status (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  aufgabe_key text NOT NULL CHECK (char_length(aufgabe_key) BETWEEN 3 AND 200),
  status text NOT NULL CHECK (status IN ('ausgeblendet', 'erledigt')),
  bis timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, aufgabe_key)
);

ALTER TABLE public.etsy_konkurrenz_shop
  ADD COLUMN IF NOT EXISTS top_tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.etsy_listing_statistik ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_listing_statistik FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_listing_verkauf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_listing_verkauf FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_aenderung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_seo_aenderung FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_aufgabe_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_aufgabe_status FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_listing_statistik FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_listing_verkauf FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_seo_aenderung FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_aufgabe_status FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_listing_statistik TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_listing_verkauf TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_seo_aenderung TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_aufgabe_status TO authenticated;

CREATE POLICY etsy_listing_statistik_owner ON public.etsy_listing_statistik
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY etsy_listing_verkauf_owner ON public.etsy_listing_verkauf
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY etsy_seo_aenderung_owner ON public.etsy_seo_aenderung
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY etsy_aufgabe_status_owner ON public.etsy_aufgabe_status
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
