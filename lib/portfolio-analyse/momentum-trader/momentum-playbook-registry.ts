/**
 * Zentrale Playbook-Registry — Metadaten für alle Setup-Typen.
 */

import type { MomentumPlaybook } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumPlaybookKategorie =
  | 'earnings'
  | 'gap_volumen'
  | 'trend'
  | 'mean_reversion'
  | 'regime'
  | 'katalysator'
  | 'pattern'

export type MomentumPlaybookMeta = {
  id: MomentumPlaybook
  label: string
  kategorie: MomentumPlaybookKategorie
  /** true = konkreter Trade jetzt möglich */
  istTrade: boolean
  /** true = jeden Scan-Tag für jeden Titel prüfen */
  taeglich: boolean
  /** true = braucht Earnings/IPO/News-Katalysator */
  brauchtKatalysator: boolean
  beschreibung: string
}

export const MOMENTUM_PLAYBOOK_REGISTRY: Record<MomentumPlaybook, MomentumPlaybookMeta> = {
  earnings_gap_fade: {
    id: 'earnings_gap_fade',
    label: 'Earnings-Gap-Fade',
    kategorie: 'earnings',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Mean-Reversion nach überdehntem Earnings-Gap',
  },
  earnings_momentum: {
    id: 'earnings_momentum',
    label: 'Earnings-Momentum',
    kategorie: 'earnings',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Fortsetzung in Surprise-Richtung nach Earnings',
  },
  earnings_pre_event: {
    id: 'earnings_pre_event',
    label: 'Pre-Event-Katalysator',
    kategorie: 'earnings',
    istTrade: false,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Szenario-Plan 0–14 Tage vor Earnings',
  },
  earnings_pre_run: {
    id: 'earnings_pre_run',
    label: 'Pre-Earnings-Run',
    kategorie: 'earnings',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Richtungs-Trade vor Zahlen mit Exit-Pflicht',
  },
  earnings_vorlauf: {
    id: 'earnings_vorlauf',
    label: 'Earnings-Vorlauf',
    kategorie: 'earnings',
    istTrade: false,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Legacy — ersetzt durch Pre-Event',
  },
  ipo_fade: {
    id: 'ipo_fade',
    label: 'IPO-Fade',
    kategorie: 'katalysator',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Short nach überdehnter Erstbewegung nach IPO',
  },
  gap_fade: {
    id: 'gap_fade',
    label: 'Tages-Gap-Fade',
    kategorie: 'gap_volumen',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Mean-Reversion nach Gap ohne Earnings-Katalysator',
  },
  gap_and_go: {
    id: 'gap_and_go',
    label: 'Gap-and-Go',
    kategorie: 'gap_volumen',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Mit dem Gap in Trend-Richtung',
  },
  volume_spike_breakout: {
    id: 'volume_spike_breakout',
    label: 'Volumen-Breakout',
    kategorie: 'gap_volumen',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'RVOL-Spike + Schluss über 20-Tage-Hoch',
  },
  trend_pullback: {
    id: 'trend_pullback',
    label: 'Trend-Pullback',
    kategorie: 'trend',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Long in Aufwärtstrend an MA20',
  },
  trend_breakout: {
    id: 'trend_breakout',
    label: 'Trend-Breakout',
    kategorie: 'trend',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Ausbruch nahe 52-Wochen-Hoch',
  },
  relative_strength_leader: {
    id: 'relative_strength_leader',
    label: 'RS-Leader',
    kategorie: 'trend',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Outperformer vs. S&P und Sektor',
  },
  oversold_bounce: {
    id: 'oversold_bounce',
    label: 'Oversold-Bounce',
    kategorie: 'mean_reversion',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Long nach RSI < 30 + unterer Bollinger',
  },
  overbought_fade: {
    id: 'overbought_fade',
    label: 'Overbought-Fade',
    kategorie: 'mean_reversion',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Short nach RSI > 70 + oberer Bollinger',
  },
  range_fade: {
    id: 'range_fade',
    label: 'Range-Fade',
    kategorie: 'mean_reversion',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Fade an 20-Tage-Range-Rändern bei niedriger ATR',
  },
  sector_rotation_long: {
    id: 'sector_rotation_long',
    label: 'Sektor-Rotation Long',
    kategorie: 'regime',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Starker Sektor-ETF + Titel führt im Sektor',
  },
  market_regime_long: {
    id: 'market_regime_long',
    label: 'Regime-Long',
    kategorie: 'regime',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Risk-on + Breadth + RS positiv',
  },
  market_regime_short: {
    id: 'market_regime_short',
    label: 'Regime-Short',
    kategorie: 'regime',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Risk-off + schwache RS — Short',
  },
  news_gap: {
    id: 'news_gap',
    label: 'News-Gap',
    kategorie: 'katalysator',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: true,
    beschreibung: 'Gap + News-Headline in gleicher Richtung',
  },
  analyst_upgrade: {
    id: 'analyst_upgrade',
    label: 'Analyst-Upgrade',
    kategorie: 'katalysator',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: true,
    beschreibung: 'Upgrade/Initiate + Momentum bestätigt',
  },
  earnings_post_run: {
    id: 'earnings_post_run',
    label: 'Earnings-Post-Run',
    kategorie: 'earnings',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Follow-Through Tag 2–5 nach Earnings',
  },
  guidance_shock: {
    id: 'guidance_shock',
    label: 'Guidance-Shock',
    kategorie: 'earnings',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'Guidance raise/lower + Gap-Reaktion',
  },
  revenue_beat_divergence: {
    id: 'revenue_beat_divergence',
    label: 'Revenue-Divergenz',
    kategorie: 'earnings',
    istTrade: true,
    taeglich: false,
    brauchtKatalysator: true,
    beschreibung: 'EPS-Beat + Revenue-Miss + Gap-Up → Short',
  },
  insider_cluster: {
    id: 'insider_cluster',
    label: 'Insider-Cluster',
    kategorie: 'katalysator',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: true,
    beschreibung: 'Mehrere Insider-Käufe (Form 4) in kurzem Fenster',
  },
  short_squeeze_setup: {
    id: 'short_squeeze_setup',
    label: 'Short-Squeeze',
    kategorie: 'katalysator',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Hoher Short Float + Volumen-Spike + Ausbruch Long',
  },
  nr7_breakout: {
    id: 'nr7_breakout',
    label: 'NR7-Breakout',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Engste 7-Tage-Range + Ausbruch mit Volumen',
  },
  inside_day_breakout: {
    id: 'inside_day_breakout',
    label: 'Inside-Day-Breakout',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Inside Day + Breakout aus Mother Bar',
  },
  failed_breakout: {
    id: 'failed_breakout',
    label: 'Failed-Breakout',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'False Break über 20T-High → Short-Fade',
  },
  relative_weakness_fade: {
    id: 'relative_weakness_fade',
    label: 'RS-Schwäche-Fade',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Underperformer vs. S&P in Abwärtstrend — Short',
  },
  capitulation_bounce: {
    id: 'capitulation_bounce',
    label: 'Capitulation-Bounce',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Panik-Tag (RSI+Drop+Volumen) → Long',
  },
  ma_cross_momentum: {
    id: 'ma_cross_momentum',
    label: 'MA-Cross-Momentum',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Frisches Golden Cross MA20/50 + RS',
  },
  trend_exhaustion: {
    id: 'trend_exhaustion',
    label: 'Trend-Exhaustion',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Überdehnter Lauf + hohes RSI → Short',
  },
  sector_laggard_catchup: {
    id: 'sector_laggard_catchup',
    label: 'Sektor-Catch-up',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'Schwacher Sektor, Titel holt auf',
  },
  vix_spike_fade: {
    id: 'vix_spike_fade',
    label: 'VIX-Spike-Fade',
    kategorie: 'pattern',
    istTrade: true,
    taeglich: true,
    brauchtKatalysator: false,
    beschreibung: 'VIX-Spike + Oversold-Titel → Mean-Reversion Long',
  },
}

export const MOMENTUM_ALL_PLAYBOOKS = Object.keys(MOMENTUM_PLAYBOOK_REGISTRY) as MomentumPlaybook[]

export const MOMENTUM_TRADE_PLAYBOOKS = MOMENTUM_ALL_PLAYBOOKS.filter(
  (p) => MOMENTUM_PLAYBOOK_REGISTRY[p].istTrade,
)

export const MOMENTUM_TAEGLICHE_PLAYBOOKS = MOMENTUM_ALL_PLAYBOOKS.filter(
  (p) => MOMENTUM_PLAYBOOK_REGISTRY[p].taeglich,
)

export const MOMENTUM_PATTERN_PLAYBOOKS = MOMENTUM_ALL_PLAYBOOKS.filter(
  (p) => MOMENTUM_PLAYBOOK_REGISTRY[p].kategorie === 'pattern',
)

export const MOMENTUM_PRE_EVENT_PLAYBOOKS: MomentumPlaybook[] = [
  'earnings_pre_event',
  'earnings_vorlauf',
]

export function playbookMeta(playbook: MomentumPlaybook): MomentumPlaybookMeta {
  return MOMENTUM_PLAYBOOK_REGISTRY[playbook]
}

export function playbookKategorieLabel(k: MomentumPlaybookKategorie): string {
  if (k === 'earnings') return 'Earnings'
  if (k === 'gap_volumen') return 'Gap & Volumen'
  if (k === 'trend') return 'Trend'
  if (k === 'mean_reversion') return 'Mean Reversion'
  if (k === 'regime') return 'Regime'
  if (k === 'pattern') return 'Pattern'
  return 'Katalysator'
}
