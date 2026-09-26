-- Unikat-Schalen: Default Herstellungszeitraum fertig (nicht Auftragsfertigung)
-- Etsy API 2026: when_made Enum ist 2020_2026 (nicht mehr 2020_2025)
ALTER TABLE public.etsy_listing_vorlage
  ALTER COLUMN when_made SET DEFAULT '2020_2026';

UPDATE public.etsy_listing_vorlage
SET when_made = '2020_2026'
WHERE when_made IN ('made_to_order', '2020_2025');

ALTER TABLE public.etsy_listing_vorlage
  ADD COLUMN IF NOT EXISTS shop_section_id bigint;
