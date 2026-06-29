-- Momentum Trader — persönliche Watchlist (statt Volluniversum).

CREATE TABLE IF NOT EXISTS public.momentum_watchlist (
  owner_user_id     uuid        NOT NULL DEFAULT auth.uid(),
  isin              text        NOT NULL,
  name              text        NOT NULL DEFAULT '',
  symbol_yahoo      text,
  symbol_candidates jsonb       NOT NULL DEFAULT '[]'::jsonb,
  hinzugefuegt_am   timestamptz NOT NULL DEFAULT now(),
  earnings_sync_am  timestamptz,
  PRIMARY KEY (owner_user_id, isin)
);

CREATE INDEX IF NOT EXISTS idx_momentum_watchlist_owner
  ON public.momentum_watchlist (owner_user_id, hinzugefuegt_am DESC);

COMMENT ON TABLE public.momentum_watchlist IS
  'Momentum Trader: manuell gepflegte Watchlist — nur diese Titel werden gescrapt und gesynct.';

ALTER TABLE public.momentum_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nur eigene Momentum-Watchlist lesen"
  ON public.momentum_watchlist FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Nur eigene Momentum-Watchlist hinzufügen"
  ON public.momentum_watchlist FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Nur eigene Momentum-Watchlist aktualisieren"
  ON public.momentum_watchlist FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Nur eigene Momentum-Watchlist löschen"
  ON public.momentum_watchlist FOR DELETE
  USING (owner_user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
