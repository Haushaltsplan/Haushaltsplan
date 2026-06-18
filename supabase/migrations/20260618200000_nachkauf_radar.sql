-- Nachkauf-Radar: monatliche Scan-Ergebnisse und Deep-Research-Memos.
-- Kein RLS für normale User — nur Service Role über API-Routen.

CREATE TABLE IF NOT EXISTS public.nachkauf_radar_scan (
  ticker         text        NOT NULL,
  isin           text        NOT NULL DEFAULT '',
  name           text        NOT NULL DEFAULT '',
  ampel          text        NOT NULL DEFAULT 'grau'
                             CHECK (ampel IN ('gruen', 'gelb', 'rot', 'grau', 'teuer')),
  score          integer     NOT NULL DEFAULT 0,
  mantra_ampel   text,
  mantra_score_pct integer,
  sell_trigger_ok boolean    NOT NULL DEFAULT true,
  ki_begruendung text,
  fcf_yield_pct  real,
  forward_pe     real,
  drawdown_52w_pct real,
  gescannt_am    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker)
);

CREATE INDEX IF NOT EXISTS idx_nachkauf_radar_scan_ampel
  ON public.nachkauf_radar_scan (ampel);

COMMENT ON TABLE public.nachkauf_radar_scan IS
  'Nachkauf-Radar: letzter Scan-Score + KI-Kurzbegründung je Depot-Titel (Stufe A).';

CREATE TABLE IF NOT EXISTS public.nachkauf_radar_deep_research (
  ticker       text        NOT NULL,
  isin         text        NOT NULL DEFAULT '',
  memo         text        NOT NULL,
  erstellt_am  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker)
);

COMMENT ON TABLE public.nachkauf_radar_deep_research IS
  'Nachkauf-Radar: Deep-Research-Memos je Depot-Titel (Stufe B, Gemini Pro).';

ALTER TABLE public.nachkauf_radar_scan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachkauf_radar_scan         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nachkauf_radar_deep_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachkauf_radar_deep_research FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.nachkauf_radar_scan         FROM anon, PUBLIC, authenticated;
REVOKE ALL ON TABLE public.nachkauf_radar_deep_research FROM anon, PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
