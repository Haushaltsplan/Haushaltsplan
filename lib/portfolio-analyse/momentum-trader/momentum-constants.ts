/** Standard-Einsatz (Margin) für XTB-CFD — Position daraus, Stop bleibt technisch (ATR). */
export const CFD_DEFAULT_MARGIN_EUR = 50

/** BaFin/ESMA Retail-CFD Aktien in DE + XTB: fester Hebel 1:5 (keine niedrigere Stufe wählbar). */
export const CFD_HEBEL_XTB = 5

/** Alias — Planung nutzt immer diesen Hebel. */
export const CFD_MAX_HEBEL_DE = CFD_HEBEL_XTB

/** Planungs-Score 0–100: ab hier Top-Trades-Filter. */
export const PLANUNG_TOP_MIN_SCORE = 58

/** Planungs-Score: Mindest für „Jetzt“-Badge / aktiven Trade. */
export const PLANUNG_HANDELN_MIN_SCORE = 54

/** Mindest-Wahrscheinlichkeit für Top-Signale in der UI. */
export const MOMENTUM_MIN_SIGNAL_PCT = 58

/** Max. Top-Signale in der Handlungsempfehlung. */
export const MOMENTUM_MAX_TOP_SIGNALE = 5

/** Browser-Push ab dieser Erfolgswahrscheinlichkeit (%). */
export const TOP_SIGNAL_PUSH_MIN_PCT = 68

/** Playbook pausieren wenn Backtest-Trefferquote darunter (%). */
export const PLAYBOOK_MIN_BACKTEST_TREFFER_PCT = 45

/** Unter dieser Backtest-Quote: Setup nie aktiv (genug Samples). */
export const PLAYBOOK_HARD_BLOCK_TREFFER_PCT = 38

/** Mindest-kalibrierte Erfolgs-% für aktiven Trade (grün). */
export const TRADE_AKTIV_MIN_PCT = 56

/** Gelbe Ampel braucht höhere Hürde. */
export const TRADE_GELB_MIN_PCT = 62

/** Top-Signale / Handlungsempfehlung. */
export const TRADE_TOP_MIN_PCT = 64

/** Mindest-Score für aktiven Trade. */
export const TRADE_AKTIV_MIN_SCORE = 58

/** Mindest-Anteil bestandener Gates (wenn nicht 100%). */
export const TRADE_AKTIV_MIN_GATE_RATIO = 0.85

/** Mindest Reward/Risk für aktiven Trade. */
export const TRADE_MIN_REWARD_RISK = 1.5

/** Mindest-Erwartungswert in R-Einheiten (p×RR − (1−p)). */
export const TRADE_ERWARTUNGSWERT_MIN_R = 0.25

/** Long vs. Short Konflikt: Mindest-Spread in Erfolgs-%. */
export const KONFLIKT_MIN_DIFF_PCT = 15

/** Long vs. Short Konflikt: Mindest-Spread im Planungs-Score. */
export const PLANUNG_KONFLIKT_MIN_DIFF = 8

/** Gap-Fade Schwellen (Earnings). */
export const GAP_MIN_PCT = 5
export const RVOL_MIN = 1.5
export const GAP_MEDIAN_FAKTOR = 2

/** Tages-Gap (ohne Earnings). */
export const DAILY_GAP_FADE_MIN_PCT = 3
export const DAILY_GAP_GO_MIN_PCT = 2
export const DAILY_RVOL_MIN = 1.3
export const DAILY_RVOL_GO_MIN = 2
export const DAILY_RVOL_BREAKOUT_MIN = 3

/** Pre-Event: Mindest-Median-Gap für „volatiles“ Profil (%). */
export const PRE_EVENT_GAP_MEDIAN_MIN = 3
export const PRE_EVENT_GAP_MEDIAN_STARK = 5
/** ATR vs. 20-Tage-Schnitt — Mindest-Faktor für Spannungs-Bonus. */
export const PRE_EVENT_ATR_ELEVATION_MIN = 1.12

/** Pre-Run: handelbar 1–7 Tage vor Earnings (Exit vor Event). */
export const EARNINGS_PRE_RUN_MIN = 1
export const EARNINGS_PRE_RUN_MAX = 7

/** Earnings-Vorlauf: Tage bis zum Termin (Katalysator-Fenster). */
export const EARNINGS_VORLAUF_MIN = 3
export const EARNINGS_VORLAUF_MAX = 14
/** Beobachtung im Scan bis zu diesem Horizont (Tage bis Earnings). */
export const EARNINGS_BEOBACHTUNG_MAX_TAGE = 120

export const EARNINGS_LOOKBACK_TAGE = 3

/** Tage um Earnings herum — tägliche Gap-Playbooks pausieren. */
export const EARNINGS_GAP_EXCLUDE_TAGE = 1

/** ATR-Multiplikatoren für Stop/Ziel. */
export const ATR_STOP_FAKTOR = 1.5
export const REWARD_RISK_RATIO = 2

/** Earnings-Momentum: Surprise-Schwelle (%). */
export const SURPRISE_BEAT_MIN_PCT = 5
export const SURPRISE_MISS_MAX_PCT = -5
export const MOMENTUM_GAP_MIN_PCT = 3

/** IPO-Fade: Tage nach IPO + Mindest-Lauf. */
export const IPO_FADE_MIN_TAGE = 2
export const IPO_FADE_MAX_TAGE = 14
export const IPO_RUN_MIN_PCT = 20
export const IPO_REVERSAL_GAP_PCT = -2

/** Relative Stärke: Long braucht Outperformance vs. Benchmark. */
export const RS_MIN_LONG_PCT = 0
export const RS_MAX_SHORT_PCT = 0
export const RS_TAGE = 20
export const RS_LEADER_MIN_PCT = 5

/** Trend-Pullback: Abstand zu MA20 (%). */
export const TREND_PULLBACK_MA_DIST_MAX_PCT = 2.5

/** Trend-Breakout: Max. Abstand zum 52W-Hoch (%). */
export const TREND_BREAKOUT_HIGH_DIST_MAX_PCT = 2

/** RSI-Schwellen. */
export const RSI_OVERSOLD = 30
export const RSI_OVERBOUGHT = 70
export const RSI_EXTREME_OVERSOLD = 25

/** Mean Reversion: Earnings-Pause (Tage). */
export const MR_EARNINGS_EXCLUDE_TAGE = 3

/** Range-Fade: max. Range-Breite (% vom Preis). */
export const RANGE_MAX_WIDTH_PCT = 12
export const RANGE_EDGE_DIST_MAX_PCT = 2.5
export const RANGE_MAX_ATR_PCT = 3.5

/** Regime-Long: VIX-Schwelle, Mindest-Breadth. */
export const REGIME_LONG_VIX_MAX = 18
export const REGIME_BREADTH_MIN_PCT = 50

/** Regime-Short: VIX-Schwelle. */
export const REGIME_SHORT_VIX_MIN = 25

/** Sektor-Rotation: Mindest-Sektor-Return 5T (%). */
export const SECTOR_ROTATION_MIN_RETURN_5D = 1
export const SECTOR_ROTATION_MIN_RS = 2

/** SPY-Crash-Schwelle für Oversold (5T, %). */
export const SPY_CRASH_5D_PCT = -3

/** Earnings erweitert: Post-Run Fenster (Tage nach Earnings). */
export const EARNINGS_POST_RUN_MIN = 2
export const EARNINGS_POST_RUN_MAX = 5
export const EARNINGS_EXTENDED_LOOKBACK_TAGE = 5

/** Guidance-Shock: Mindest-Gap (%). */
export const GUIDANCE_SHOCK_GAP_MIN_PCT = 3

/** Revenue-Divergenz: EPS-Beat, Revenue-Miss, Gap-Up. */
export const REV_DIVERGENCE_EPS_MIN = 5
export const REV_DIVERGENCE_REV_MAX = -3
export const REV_DIVERGENCE_GAP_MIN = 3

/** News-Gap. */
export const NEWS_GAP_MIN_PCT = 2
export const NEWS_MAX_ALTER_TAGE = 2

/** Analyst: max. Tage seit Upgrade/Initiate. */
export const ANALYST_AKTION_MAX_TAGE = 5

/** Backtest: Lookback, Schrittweite, Haltedauer (Handelstage). */
export const BACKTEST_LOOKBACK_TAGE = 504
export const BACKTEST_STEP_TAGE = 5
export const BACKTEST_HOLD_TAGE = 5
export const BACKTEST_MIN_SAMPLES_GLOBAL = 10
export const BACKTEST_MIN_SAMPLES_SYMBOL = 5
/** Unter dieser Stichprobe: Wahrscheinlichkeit auf max. 55 % deckeln. */
export const BACKTEST_LOW_CONFIDENCE_CAP_PCT = 52

/** Insider-Cluster (OpenInsider / Form 4). */
export const INSIDER_CLUSTER_MIN_BUYS = 3
export const INSIDER_CLUSTER_MIN_INSIDERS = 2
export const INSIDER_CLUSTER_MAX_TAGE = 30
export const INSIDER_MIN_VALUE_USD = 25_000

/** Short-Squeeze: Finviz Short Float + Volumen. */
export const SHORT_SQUEEZE_MIN_FLOAT_PCT = 15
export const SHORT_SQUEEZE_MIN_RVOL = 2
export const SHORT_SQUEEZE_MIN_GAP_PCT = 1.5
export const SHORT_SQUEEZE_MAX_RSI = 78

/** Pattern-Playbooks. */
export const NR7_FENSTER = 7
export const NR7_MIN_RVOL = 1.5
export const INSIDE_DAY_MIN_RVOL = 1.3
export const FAILED_BREAKOUT_MIN_RVOL = 1.4
export const REL_WEAKNESS_MAX_RS_PCT = -5
export const CAPITULATION_RSI_MAX = 25
export const CAPITULATION_DAY_MIN_DROP_PCT = -3
export const CAPITULATION_MIN_RVOL = 2
export const MA_CROSS_LOOKBACK_TAGE = 5
export const TREND_EXHAUSTION_MIN_RUN_PCT = 12
export const TREND_EXHAUSTION_MIN_RSI = 72
export const TREND_EXHAUSTION_MA_DIST_MIN_PCT = 4
export const SECTOR_LAGGARD_MAX_SECTOR_RET = -0.5
export const SECTOR_LAGGARD_MIN_RS = 1
export const VIX_SPIKE_MIN_CHANGE_PCT = 8
export const VIX_SPIKE_FADE_SPY_MAX_PCT = -2
export const VIX_SPIKE_FADE_RSI_MAX = 38

import type { MomentumPlaybook } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { MOMENTUM_PLAYBOOK_REGISTRY } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'

export function momentumPlaybookLabel(playbook: string): string {
  const meta = MOMENTUM_PLAYBOOK_REGISTRY[playbook as MomentumPlaybook]
  if (meta) return meta.label
  return playbook
}
