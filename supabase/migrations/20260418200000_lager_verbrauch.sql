-- Manueller Verbrauch / Ausbuchen (Bestand ↓), protokolliert; Buchung nur über API (Service Role).

CREATE TABLE IF NOT EXISTS public.lager_verbrauch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES public.produkte (id) ON DELETE CASCADE,
  menge numeric NOT NULL CHECK (menge > 0),
  notiz text,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  quelle text NOT NULL DEFAULT 'manuell'
);

CREATE INDEX IF NOT EXISTS idx_lager_verbrauch_produkt ON public.lager_verbrauch (produkt_id);

COMMENT ON TABLE public.lager_verbrauch IS 'Manuell gebuchter Verbrauch; Bestand = lagerbestand, Ø-Preis bleibt aus lager_einkauf.';

ALTER TABLE public.lager_verbrauch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lager_verbrauch_select_anon" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_select_anon" ON public.lager_verbrauch FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lager_verbrauch_select_authenticated" ON public.lager_verbrauch;
CREATE POLICY "lager_verbrauch_select_authenticated" ON public.lager_verbrauch FOR SELECT TO authenticated USING (true);
