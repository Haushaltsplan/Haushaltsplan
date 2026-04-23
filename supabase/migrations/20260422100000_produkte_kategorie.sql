-- Warengruppe pro Artikel (für Übersicht, KI-Bon-Import, Filter)

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS kategorie text NOT NULL DEFAULT 'Sonstiges';

COMMENT ON COLUMN public.produkte.kategorie IS 'Warengruppe: Gemüse, Getränke, Süßigkeiten, …';

UPDATE public.produkte SET kategorie = 'Sonstiges' WHERE kategorie IS NULL OR trim(kategorie) = '';
