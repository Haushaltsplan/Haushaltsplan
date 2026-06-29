/** Standard-Risiko pro Trade (EUR). */
export const MOMENTUM_DEFAULT_RISK_EUR = 10

export const MOMENTUM_MAX_RISK_EUR = 10

/** Gap-Fade Schwellen. */
export const GAP_MIN_PCT = 5
export const RVOL_MIN = 1.5
export const GAP_MEDIAN_FAKTOR = 2

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

export function momentumPlaybookLabel(playbook: string): string {
  if (playbook === 'earnings_gap_fade') return 'Earnings-Gap-Fade'
  if (playbook === 'earnings_vorlauf') return 'Earnings-Vorlauf'
  if (playbook === 'earnings_pre_event') return 'Pre-Event-Katalysator'
  if (playbook === 'earnings_pre_run') return 'Pre-Earnings-Run'
  if (playbook === 'earnings_momentum') return 'Earnings-Momentum'
  if (playbook === 'ipo_fade') return 'IPO-Fade'
  return playbook
}
