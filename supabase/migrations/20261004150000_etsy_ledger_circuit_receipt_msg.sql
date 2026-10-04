-- Echte Fee-Ledger, persistenter Circuit-Breaker, Käufer-Nachrichten aus Receipts.

-- ---------------------------------------------------------------------------
-- Payment-Account Ledger (Etsy Open API, Scope transactions_r)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_payment_ledger (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  entry_id bigint NOT NULL,
  ledger_id bigint,
  amount_eur numeric(12, 2),
  balance_eur numeric(12, 4),
  currency text NOT NULL DEFAULT 'EUR',
  description text NOT NULL DEFAULT '',
  entry_type text NOT NULL DEFAULT '',
  parent_entry_id bigint,
  created_at_etsy timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  raw_json jsonb,
  PRIMARY KEY (owner_user_id, entry_id)
);

CREATE INDEX IF NOT EXISTS etsy_payment_ledger_zeit_idx
  ON public.etsy_payment_ledger (owner_user_id, created_at_etsy DESC);

CREATE TABLE IF NOT EXISTS public.etsy_payment (
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  payment_id bigint NOT NULL,
  receipt_id bigint,
  amount_gross_eur numeric(12, 2),
  amount_fees_eur numeric(12, 2),
  amount_net_eur numeric(12, 2),
  shipping_eur numeric(12, 2),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT '',
  created_at_etsy timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  raw_json jsonb,
  PRIMARY KEY (owner_user_id, payment_id)
);

CREATE INDEX IF NOT EXISTS etsy_payment_receipt_idx
  ON public.etsy_payment (owner_user_id, receipt_id);

-- ---------------------------------------------------------------------------
-- Circuit-Breaker (global, Service-Role — DataDome blockt die Server-IP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etsy_circuit_breaker (
  schluessel text PRIMARY KEY CHECK (char_length(schluessel) BETWEEN 2 AND 40),
  geblockt_bis timestamptz NOT NULL DEFAULT to_timestamp(0),
  fehler_serie integer NOT NULL DEFAULT 0,
  letzte_meldung text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Receipt-Käufertexte (Ersatz für fehlende Conversations-API)
-- ---------------------------------------------------------------------------
ALTER TABLE public.etsy_bestellung
  ADD COLUMN IF NOT EXISTS message_from_buyer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gift_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS buyer_user_id bigint;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.etsy_payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_payment_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etsy_payment FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.etsy_payment_ledger FROM anon, PUBLIC;
REVOKE ALL ON public.etsy_payment FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_payment_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_payment TO authenticated;

DROP POLICY IF EXISTS etsy_payment_ledger_owner ON public.etsy_payment_ledger;
CREATE POLICY etsy_payment_ledger_owner ON public.etsy_payment_ledger
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS etsy_payment_owner ON public.etsy_payment;
CREATE POLICY etsy_payment_owner ON public.etsy_payment
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- Circuit-Breaker: nur Service-Role (keine authenticated Policies)
REVOKE ALL ON public.etsy_circuit_breaker FROM anon, authenticated, PUBLIC;
