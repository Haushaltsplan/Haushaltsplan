-- Sparziele (Finanzguru-artig): Ziel-Betrag, aktueller Stand, optionales Zieldatum.
-- Privat pro Nutzer (owner_user_id) mit FORCE RLS analog zur Lockdown-Migration.

CREATE TABLE IF NOT EXISTS public.finanz_sparziel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  zielbetrag numeric(14,2) NOT NULL CHECK (zielbetrag > 0),
  aktuell numeric(14,2) NOT NULL DEFAULT 0 CHECK (aktuell >= 0),
  zieldatum date,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finanz_sparziel_titel_len CHECK (char_length(titel) BETWEEN 1 AND 80)
);

ALTER TABLE public.finanz_sparziel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanz_sparziel FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.finanz_sparziel FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.finanz_sparziel TO authenticated;

DROP POLICY IF EXISTS finanz_sparziel_owner_select ON public.finanz_sparziel;
CREATE POLICY finanz_sparziel_owner_select ON public.finanz_sparziel
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_sparziel_owner_insert ON public.finanz_sparziel;
CREATE POLICY finanz_sparziel_owner_insert ON public.finanz_sparziel
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_sparziel_owner_update ON public.finanz_sparziel;
CREATE POLICY finanz_sparziel_owner_update ON public.finanz_sparziel
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_sparziel_owner_delete ON public.finanz_sparziel;
CREATE POLICY finanz_sparziel_owner_delete ON public.finanz_sparziel
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
