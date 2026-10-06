-- Investment-Journal: Quartals-Gegenprüfung + Denorm-Felder

ALTER TABLE public.portfolio_investment_journal
  ADD COLUMN IF NOT EXISTS letzte_gegenpruefung_am timestamptz,
  ADD COLUMN IF NOT EXISTS letzte_gegenpruefung_status text
    CHECK (
      letzte_gegenpruefung_status IS NULL
      OR letzte_gegenpruefung_status IN ('intakt', 'unter_beobachtung', 'beschaedigt')
    );

CREATE TABLE IF NOT EXISTS public.portfolio_journal_gegenpruefung (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  journal_id      uuid        REFERENCES public.portfolio_investment_journal (id) ON DELETE SET NULL,
  ticker          text        NOT NULL DEFAULT '',
  isin            text,
  quartal_label   text        NOT NULL DEFAULT '',
  status          text        NOT NULL DEFAULT 'unter_beobachtung'
                              CHECK (status IN ('intakt', 'unter_beobachtung', 'beschaedigt')),
  fazit           text        NOT NULL DEFAULT '',
  details_json    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ki_modell       text,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_journal_gegenpruefung_owner_ticker_idx
  ON public.portfolio_journal_gegenpruefung (owner_user_id, ticker, erstellt_am DESC);

CREATE INDEX IF NOT EXISTS portfolio_journal_gegenpruefung_journal_idx
  ON public.portfolio_journal_gegenpruefung (journal_id, erstellt_am DESC)
  WHERE journal_id IS NOT NULL;

ALTER TABLE public.portfolio_journal_gegenpruefung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_journal_gegenpruefung FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_journal_gegenpruefung FROM anon, PUBLIC, authenticated;

COMMENT ON TABLE public.portfolio_journal_gegenpruefung IS
  'KI-Gegenprüfung Investment-These vs. Quartals-/Earnings-Daten; Historie pro Ticker.';

NOTIFY pgrst, 'reload schema';
