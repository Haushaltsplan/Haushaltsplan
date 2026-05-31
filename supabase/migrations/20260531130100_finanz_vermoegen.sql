-- Vermögensposten (manuell): z. B. Depotwert, Tagesgeld, Bargeld.
-- Gesamtvermögen in der App = Erarbeiteter Puffer + Sparziele + diese Posten.
-- Privat pro Nutzer (owner_user_id) mit FORCE RLS analog zur Lockdown-Migration.

CREATE TABLE IF NOT EXISTS public.finanz_vermoegen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  betrag numeric(14,2) NOT NULL DEFAULT 0,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finanz_vermoegen_titel_len CHECK (char_length(titel) BETWEEN 1 AND 80)
);

ALTER TABLE public.finanz_vermoegen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanz_vermoegen FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.finanz_vermoegen FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.finanz_vermoegen TO authenticated;

DROP POLICY IF EXISTS finanz_vermoegen_owner_select ON public.finanz_vermoegen;
CREATE POLICY finanz_vermoegen_owner_select ON public.finanz_vermoegen
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_vermoegen_owner_insert ON public.finanz_vermoegen;
CREATE POLICY finanz_vermoegen_owner_insert ON public.finanz_vermoegen
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_vermoegen_owner_update ON public.finanz_vermoegen;
CREATE POLICY finanz_vermoegen_owner_update ON public.finanz_vermoegen
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_vermoegen_owner_delete ON public.finanz_vermoegen;
CREATE POLICY finanz_vermoegen_owner_delete ON public.finanz_vermoegen
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
