-- Portfolioanalyse: anonymisierte Broker-Buchungen (Trade Republic u. a.)
-- Keine Roh-PDFs/CSVs — nur strukturierte, personenfreie Felder.

CREATE TABLE IF NOT EXISTS public.portfolio_analyse_buchung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  buchungs_hash text NOT NULL,
  datum date NOT NULL,
  typ text NOT NULL CHECK (
    typ IN ('kauf', 'verkauf', 'dividende', 'zins', 'einzahlung', 'auszahlung', 'steuer', 'gebuehr', 'sonstiges')
  ),
  isin text,
  wertpapier_name text,
  stueck numeric(18, 8),
  kurs_eur numeric(14, 6),
  betrag_eur numeric(14, 2) NOT NULL,
  asset_klasse text NOT NULL DEFAULT 'sonstiges' CHECK (
    asset_klasse IN ('aktie', 'etf', 'anleihe', 'crypto', 'geldmarkt', 'sonstiges')
  ),
  quelle text NOT NULL CHECK (quelle IN ('pdf', 'csv')),
  importiert_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_analyse_buchung_owner_hash_unique UNIQUE (owner_user_id, buchungs_hash),
  CONSTRAINT portfolio_analyse_buchung_hash_len CHECK (char_length(buchungs_hash) BETWEEN 16 AND 128),
  CONSTRAINT portfolio_analyse_buchung_isin_fmt CHECK (isin IS NULL OR isin ~ '^[A-Z]{2}[A-Z0-9]{10}$')
);

CREATE INDEX IF NOT EXISTS portfolio_analyse_buchung_owner_datum_idx
  ON public.portfolio_analyse_buchung (owner_user_id, datum DESC);

CREATE TABLE IF NOT EXISTS public.portfolio_analyse_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  erfasst_am timestamptz NOT NULL DEFAULT now(),
  depotwert_eur numeric(14, 2),
  positionen jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT portfolio_analyse_snapshot_positionen_array CHECK (jsonb_typeof(positionen) = 'array')
);

CREATE INDEX IF NOT EXISTS portfolio_analyse_snapshot_owner_erfasst_idx
  ON public.portfolio_analyse_snapshot (owner_user_id, erfasst_am DESC);

ALTER TABLE public.portfolio_analyse_buchung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_analyse_buchung FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_analyse_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_analyse_snapshot FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_analyse_buchung FROM anon;
REVOKE ALL ON TABLE public.portfolio_analyse_snapshot FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_analyse_buchung TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_analyse_snapshot TO authenticated;

DROP POLICY IF EXISTS portfolio_analyse_buchung_owner_select ON public.portfolio_analyse_buchung;
CREATE POLICY portfolio_analyse_buchung_owner_select ON public.portfolio_analyse_buchung
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_buchung_owner_insert ON public.portfolio_analyse_buchung;
CREATE POLICY portfolio_analyse_buchung_owner_insert ON public.portfolio_analyse_buchung
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_buchung_owner_update ON public.portfolio_analyse_buchung;
CREATE POLICY portfolio_analyse_buchung_owner_update ON public.portfolio_analyse_buchung
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_buchung_owner_delete ON public.portfolio_analyse_buchung;
CREATE POLICY portfolio_analyse_buchung_owner_delete ON public.portfolio_analyse_buchung
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_snapshot_owner_select ON public.portfolio_analyse_snapshot;
CREATE POLICY portfolio_analyse_snapshot_owner_select ON public.portfolio_analyse_snapshot
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_snapshot_owner_insert ON public.portfolio_analyse_snapshot;
CREATE POLICY portfolio_analyse_snapshot_owner_insert ON public.portfolio_analyse_snapshot
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_snapshot_owner_update ON public.portfolio_analyse_snapshot;
CREATE POLICY portfolio_analyse_snapshot_owner_update ON public.portfolio_analyse_snapshot
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS portfolio_analyse_snapshot_owner_delete ON public.portfolio_analyse_snapshot;
CREATE POLICY portfolio_analyse_snapshot_owner_delete ON public.portfolio_analyse_snapshot
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
