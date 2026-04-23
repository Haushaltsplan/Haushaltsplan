-- Rest-Topf: automatische Monatsbuchung (App) + nachträgliche Korrektur per UPDATE

ALTER TABLE public.finanz_rest_topf_monatsbuchung
  ADD COLUMN IF NOT EXISTS automatisch boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.finanz_rest_topf_monatsbuchung.automatisch IS 'true wenn der Monatssaldo von der App automatisch übernommen wurde';

DROP POLICY IF EXISTS "finanz_rest_topf_monat_update_anon" ON public.finanz_rest_topf_monatsbuchung;
CREATE POLICY "finanz_rest_topf_monat_update_anon" ON public.finanz_rest_topf_monatsbuchung
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "finanz_rest_topf_monat_update_auth" ON public.finanz_rest_topf_monatsbuchung;
CREATE POLICY "finanz_rest_topf_monat_update_auth" ON public.finanz_rest_topf_monatsbuchung
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT UPDATE ON TABLE public.finanz_rest_topf_monatsbuchung TO anon, authenticated;
