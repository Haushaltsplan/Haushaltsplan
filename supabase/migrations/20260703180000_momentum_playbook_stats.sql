-- Momentum Trader Phase 4: Backtest-Kalibrierung pro Playbook

CREATE TABLE IF NOT EXISTS public.momentum_playbook_stats (
  playbook        text        NOT NULL,
  symbol          text        NOT NULL DEFAULT '',
  wins            int         NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses          int         NOT NULL DEFAULT 0 CHECK (losses >= 0),
  timeouts        int         NOT NULL DEFAULT 0 CHECK (timeouts >= 0),
  treffer_pct     numeric(5, 2),
  fenster_tage    int         NOT NULL DEFAULT 504,
  berechnet_am    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playbook, symbol)
);

CREATE INDEX IF NOT EXISTS idx_momentum_playbook_stats_playbook
  ON public.momentum_playbook_stats (playbook);

COMMENT ON TABLE public.momentum_playbook_stats IS
  'Historische Trefferquoten pro Playbook (symbol leer = Watchlist-Aggregat).';
