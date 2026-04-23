-- Rest-Topf: kumulierter Stand = stand_offset (Singleton) + Summe aller Monats-Saldi (ein Eintrag pro YYYY-MM).
-- Positiver Monatssaldo (Einnahmen > Ausgaben) erhöht den Topf, negativer senkt ihn.

CREATE TABLE IF NOT EXISTS public.finanz_rest_topf_meta (
  id smallint PRIMARY KEY DEFAULT 1,
  stand_offset numeric(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT finanz_rest_topf_meta_singleton CHECK (id = 1)
);

INSERT INTO public.finanz_rest_topf_meta (id, stand_offset) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.finanz_rest_topf_monatsbuchung (
  monat text PRIMARY KEY,
  saldo_monat numeric(14,2) NOT NULL,
  gebucht_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finanz_rest_topf_monat_format CHECK (char_length(monat) = 7 AND monat ~ '^[0-9]{4}-[0-9]{2}$')
);

ALTER TABLE public.finanz_rest_topf_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanz_rest_topf_monatsbuchung ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finanz_rest_topf_meta_select_anon" ON public.finanz_rest_topf_meta;
CREATE POLICY "finanz_rest_topf_meta_select_anon" ON public.finanz_rest_topf_meta FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "finanz_rest_topf_meta_update_anon" ON public.finanz_rest_topf_meta;
CREATE POLICY "finanz_rest_topf_meta_update_anon" ON public.finanz_rest_topf_meta FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "finanz_rest_topf_meta_select_auth" ON public.finanz_rest_topf_meta;
CREATE POLICY "finanz_rest_topf_meta_select_auth" ON public.finanz_rest_topf_meta FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "finanz_rest_topf_meta_update_auth" ON public.finanz_rest_topf_meta;
CREATE POLICY "finanz_rest_topf_meta_update_auth" ON public.finanz_rest_topf_meta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "finanz_rest_topf_monat_select_anon" ON public.finanz_rest_topf_monatsbuchung;
CREATE POLICY "finanz_rest_topf_monat_select_anon" ON public.finanz_rest_topf_monatsbuchung FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "finanz_rest_topf_monat_insert_anon" ON public.finanz_rest_topf_monatsbuchung;
CREATE POLICY "finanz_rest_topf_monat_insert_anon" ON public.finanz_rest_topf_monatsbuchung FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "finanz_rest_topf_monat_select_auth" ON public.finanz_rest_topf_monatsbuchung;
CREATE POLICY "finanz_rest_topf_monat_select_auth" ON public.finanz_rest_topf_monatsbuchung FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "finanz_rest_topf_monat_insert_auth" ON public.finanz_rest_topf_monatsbuchung;
CREATE POLICY "finanz_rest_topf_monat_insert_auth" ON public.finanz_rest_topf_monatsbuchung FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, UPDATE ON TABLE public.finanz_rest_topf_meta TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.finanz_rest_topf_monatsbuchung TO anon, authenticated;
