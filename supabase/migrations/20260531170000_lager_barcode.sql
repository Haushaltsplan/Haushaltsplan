-- Barcode-Bindung für die Speisekammer (Grocy-Stil): ein gescannter EAN/Barcode
-- wird einem Produkt zugeordnet, damit Scannen direkt den richtigen Artikel öffnet.
-- Optional (NULL = kein Barcode hinterlegt). RLS für public.produkte besteht bereits.
ALTER TABLE public.produkte ADD COLUMN IF NOT EXISTS barcode text;

-- Schneller Lookup + verhindert, dass derselbe Code an zwei Artikel geht.
CREATE UNIQUE INDEX IF NOT EXISTS produkte_barcode_uidx
  ON public.produkte (barcode)
  WHERE barcode IS NOT NULL;

COMMENT ON COLUMN public.produkte.barcode IS 'Gescannter Barcode/EAN zur direkten Artikel-Zuordnung. NULL = keiner.';
