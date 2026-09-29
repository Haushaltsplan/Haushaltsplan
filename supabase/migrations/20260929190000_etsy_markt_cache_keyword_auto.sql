-- Shop-weiter Keyword-Auto-Scan (24h-Cache in etsy_markt_cache).
ALTER TABLE public.etsy_markt_cache DROP CONSTRAINT IF EXISTS etsy_markt_cache_kind_check;
ALTER TABLE public.etsy_markt_cache
  ADD CONSTRAINT etsy_markt_cache_kind_check
  CHECK (kind IN ('suggest', 'competitor', 'keyword_auto'));
