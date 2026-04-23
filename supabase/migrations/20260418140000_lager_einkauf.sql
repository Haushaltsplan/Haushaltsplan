-- Einkaufszeilen vom Kassenzettel (Durchschnittskaufpreis = SUM(gesamtpreis) / SUM(menge) pro Produkt)
-- In Supabase SQL Editor ausführen, falls du ohne CLI migrierst.

CREATE TABLE IF NOT EXISTS public.lager_einkauf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES public.produkte (id) ON DELETE CASCADE,
  menge numeric NOT NULL CHECK (menge > 0),
  gesamtpreis numeric NOT NULL CHECK (gesamtpreis >= 0),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  quelle text NOT NULL DEFAULT 'kassenzettel_ki'
);

CREATE INDEX IF NOT EXISTS idx_lager_einkauf_produkt ON public.lager_einkauf (produkt_id);

COMMENT ON TABLE public.lager_einkauf IS 'Kassenzeilen; gewichteter Ø-Preis = Summe(gesamtpreis) / Summe(menge)';

-- Bestand pro Produkt (falls noch nicht vorhanden — bei bestehender Tabelle mit anderem Aufbau bitte manuell prüfen)
CREATE TABLE IF NOT EXISTS public.lagerbestand (
  produkt_id uuid PRIMARY KEY REFERENCES public.produkte (id) ON DELETE CASCADE,
  aktuelle_menge numeric NOT NULL DEFAULT 0 CHECK (aktuelle_menge >= 0)
);

ALTER TABLE public.lager_einkauf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lager_einkauf_select_anon" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_select_anon" ON public.lager_einkauf FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "lager_einkauf_select_authenticated" ON public.lager_einkauf;
CREATE POLICY "lager_einkauf_select_authenticated" ON public.lager_einkauf FOR SELECT TO authenticated USING (true);

-- Keine INSERT/UPDATE für anon: Buchung nur über API mit Service Role
