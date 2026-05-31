-- Chargen (MHD pro Einkauf) + „Immer da“-Favoriten
CREATE TABLE IF NOT EXISTS public.lager_charge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id uuid NOT NULL REFERENCES public.produkte(id) ON DELETE CASCADE,
  menge numeric(12, 3) NOT NULL CHECK (menge >= 0),
  mhd date,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  lager_einkauf_id uuid REFERENCES public.lager_einkauf(id) ON DELETE SET NULL,
  owner_user_id uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS lager_charge_produkt_idx ON public.lager_charge (produkt_id);
CREATE INDEX IF NOT EXISTS lager_charge_mhd_idx ON public.lager_charge (produkt_id, mhd) WHERE mhd IS NOT NULL;

COMMENT ON TABLE public.lager_charge IS 'Bestandschargen mit optionalem MHD (FIFO beim Verbrauch).';

ALTER TABLE public.produkte ADD COLUMN IF NOT EXISTS immer_da boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.produkte.immer_da IS 'Immer auf der Einkaufsliste, wenn unter Mindestbestand.';

-- Bestehenden Bestand als eine Charge übernehmen (einmalig).
INSERT INTO public.lager_charge (produkt_id, menge, mhd)
SELECT lb.produkt_id, lb.aktuelle_menge, p.mhd
FROM public.lagerbestand lb
JOIN public.produkte p ON p.id = lb.produkt_id
WHERE lb.aktuelle_menge > 0
  AND NOT EXISTS (SELECT 1 FROM public.lager_charge c WHERE c.produkt_id = lb.produkt_id);

UPDATE public.lager_charge c
SET owner_user_id = p.owner_user_id
FROM public.produkte p
WHERE c.produkt_id = p.id AND c.owner_user_id IS NULL;

ALTER TABLE public.lager_charge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lager_charge FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lager_charge FROM anon;
REVOKE ALL ON TABLE public.lager_charge FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lager_charge TO authenticated;

DROP POLICY IF EXISTS lager_charge_owner_select ON public.lager_charge;
CREATE POLICY lager_charge_owner_select ON public.lager_charge FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
DROP POLICY IF EXISTS lager_charge_owner_insert ON public.lager_charge;
CREATE POLICY lager_charge_owner_insert ON public.lager_charge FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS lager_charge_owner_update ON public.lager_charge;
CREATE POLICY lager_charge_owner_update ON public.lager_charge FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS lager_charge_owner_delete ON public.lager_charge;
CREATE POLICY lager_charge_owner_delete ON public.lager_charge FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
