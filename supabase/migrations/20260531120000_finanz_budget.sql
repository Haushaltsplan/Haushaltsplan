-- Budgets pro Oberkategorie (Finanzguru-artig): ein Monatslimit je Kategorie-Key.
-- Privat pro Nutzer (owner_user_id) mit FORCE RLS analog zur Lockdown-Migration.

CREATE TABLE IF NOT EXISTS public.finanz_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kategorie_key text NOT NULL,
  monatslimit numeric(14,2) NOT NULL CHECK (monatslimit >= 0),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finanz_budget_kategorie_key_format CHECK (char_length(kategorie_key) BETWEEN 1 AND 40),
  CONSTRAINT finanz_budget_owner_kategorie_unique UNIQUE (owner_user_id, kategorie_key)
);

ALTER TABLE public.finanz_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finanz_budget FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.finanz_budget FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.finanz_budget TO authenticated;

DROP POLICY IF EXISTS finanz_budget_owner_select ON public.finanz_budget;
CREATE POLICY finanz_budget_owner_select ON public.finanz_budget
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_budget_owner_insert ON public.finanz_budget;
CREATE POLICY finanz_budget_owner_insert ON public.finanz_budget
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_budget_owner_update ON public.finanz_budget;
CREATE POLICY finanz_budget_owner_update ON public.finanz_budget
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS finanz_budget_owner_delete ON public.finanz_budget;
CREATE POLICY finanz_budget_owner_delete ON public.finanz_budget
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());
