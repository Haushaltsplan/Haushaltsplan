-- Investments-Portfolio: editierbare Positionen + Flag „Nutzerliste aktiv“ (leer ≠ Standardliste aus dem Code).

CREATE TABLE IF NOT EXISTS public.investment_portfolio_flag (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nutzerliste_aktiv boolean NOT NULL DEFAULT false
);

INSERT INTO public.investment_portfolio_flag (id, nutzerliste_aktiv)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.investment_portfolio_position (
  id text PRIMARY KEY,
  name text NOT NULL,
  symbol_yahoo text NOT NULL,
  notierung text NOT NULL DEFAULT 'USD',
  notiz text NOT NULL DEFAULT '',
  sort_index integer NOT NULL DEFAULT 0,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investment_portfolio_sort ON public.investment_portfolio_position (sort_index);

COMMENT ON TABLE public.investment_portfolio_flag IS 'nutzerliste_aktiv: false → App zeigt eingebaute Standardliste bis zur ersten Speicherung.';
COMMENT ON TABLE public.investment_portfolio_position IS 'Benutzerdefinierte Watchlist für Investments-Seite und Portfolio-News auf der Startseite.';

ALTER TABLE public.investment_portfolio_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_portfolio_position ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_portfolio_flag_select_anon" ON public.investment_portfolio_flag;
CREATE POLICY "investment_portfolio_flag_select_anon" ON public.investment_portfolio_flag FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "investment_portfolio_flag_update_anon" ON public.investment_portfolio_flag;
CREATE POLICY "investment_portfolio_flag_update_anon" ON public.investment_portfolio_flag FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "investment_portfolio_flag_select_auth" ON public.investment_portfolio_flag;
CREATE POLICY "investment_portfolio_flag_select_auth" ON public.investment_portfolio_flag FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "investment_portfolio_flag_update_auth" ON public.investment_portfolio_flag;
CREATE POLICY "investment_portfolio_flag_update_auth" ON public.investment_portfolio_flag FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "investment_portfolio_position_select_anon" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_select_anon" ON public.investment_portfolio_position FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "investment_portfolio_position_insert_anon" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_insert_anon" ON public.investment_portfolio_position FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "investment_portfolio_position_update_anon" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_update_anon" ON public.investment_portfolio_position FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "investment_portfolio_position_delete_anon" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_delete_anon" ON public.investment_portfolio_position FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "investment_portfolio_position_select_auth" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_select_auth" ON public.investment_portfolio_position FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "investment_portfolio_position_insert_auth" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_insert_auth" ON public.investment_portfolio_position FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "investment_portfolio_position_update_auth" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_update_auth" ON public.investment_portfolio_position FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "investment_portfolio_position_delete_auth" ON public.investment_portfolio_position;
CREATE POLICY "investment_portfolio_position_delete_auth" ON public.investment_portfolio_position FOR DELETE TO authenticated USING (true);
