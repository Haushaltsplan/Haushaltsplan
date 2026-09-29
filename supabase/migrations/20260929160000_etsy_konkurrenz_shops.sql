-- Etsy: Konkurrenz-Verkaufschart (Top-DE-Shops „gedrechselte Schalen“)
-- Etsy liefert pro Shop nur den Lebenszeit-Zähler transaction_sold_count →
-- täglicher Snapshot; Differenz zweier Tage = Verkäufe im Zeitraum.

CREATE TABLE IF NOT EXISTS public.etsy_konkurrenz_shop (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  shop_id bigint NOT NULL,
  shop_name text NOT NULL,
  url text,
  icon_url text,
  treffer integer NOT NULL DEFAULT 0,
  preis_median numeric(10, 2),
  eigener boolean NOT NULL DEFAULT false,
  aktiv boolean NOT NULL DEFAULT true,
  entdeckt_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, shop_id)
);

CREATE TABLE IF NOT EXISTS public.etsy_konkurrenz_snapshot (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  shop_id bigint NOT NULL,
  tag date NOT NULL,
  verkaeufe_gesamt integer NOT NULL,
  bewertungen integer,
  bewertung_schnitt numeric(3, 2),
  aktive_listings integer,
  favoriten integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, shop_id, tag)
);

CREATE INDEX IF NOT EXISTS etsy_konkurrenz_snapshot_tag_idx
  ON public.etsy_konkurrenz_snapshot (owner_user_id, tag);

ALTER TABLE public.etsy_konkurrenz_shop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_konkurrenz_shop FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_konkurrenz_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_konkurrenz_snapshot FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_konkurrenz_shop FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_konkurrenz_snapshot FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_konkurrenz_shop TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_konkurrenz_snapshot TO authenticated;

CREATE POLICY etsy_konkurrenz_shop_owner ON public.etsy_konkurrenz_shop
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY etsy_konkurrenz_snapshot_owner ON public.etsy_konkurrenz_snapshot
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
