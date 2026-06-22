-- Nachkauf-Radar: Erweiterte Spalten für persistente Score-Details, Trigger und Notizen.
-- Neue Tabellen: nachkauf_radar_notizen, nachkauf_radar_kaufhistorie_cache

-- ============================================================================
-- nachkauf_radar_scan: neue Spalten
-- ============================================================================

-- Score-Zerlegung (damit nach Reload vollständig re-hydrierbbar)
ALTER TABLE public.nachkauf_radar_scan
  ADD COLUMN IF NOT EXISTS score_mantra        integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_bewertung     integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_hist_bonus    integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_sell_penalty  integer  DEFAULT 0;

-- Historischer Premium/Discount vs. 5J-Median (%)
ALTER TABLE public.nachkauf_radar_scan
  ADD COLUMN IF NOT EXISTS premium_discount_pct numeric(6,2);

-- Kaufzonen-Trigger
ALTER TABLE public.nachkauf_radar_scan
  ADD COLUMN IF NOT EXISTS kauf_trigger_ausgeloest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kauf_trigger_text       text;

-- ============================================================================
-- nachkauf_radar_notizen: Freitext-Notizen pro Titel
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nachkauf_radar_notizen (
  ticker      text        NOT NULL,
  notiz       text        NOT NULL DEFAULT '',
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker)
);

COMMENT ON TABLE public.nachkauf_radar_notizen IS
  'Freitext-Notizen pro Whitelist-Position (z. B. "Warte auf Q2-Zahlen").';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nachkauf_radar_notizen TO service_role;

-- ============================================================================
-- nachkauf_radar_kaufhistorie_cache: letzter Nachkauf aus Buchungen (Cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nachkauf_radar_kaufhistorie_cache (
  ticker          text        NOT NULL,
  isin            text        NOT NULL DEFAULT '',
  letzter_kauf_am date,
  anzahl_kaeufe   integer     NOT NULL DEFAULT 0,
  avg_kaufpreis_eur numeric(12,4),
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker)
);

COMMENT ON TABLE public.nachkauf_radar_kaufhistorie_cache IS
  'Cache: letzter Nachkauf-Zeitpunkt aus portfolio_analyse_buchung je Whitelist-Ticker.';

GRANT SELECT, INSERT, UPDATE ON TABLE public.nachkauf_radar_kaufhistorie_cache TO service_role;

NOTIFY pgrst, 'reload schema';
