/** Standard-Risiko pro Trade (EUR). */
export const MOMENTUM_DEFAULT_RISK_EUR = 10

export const MOMENTUM_MAX_RISK_EUR = 10

/** Gap-Fade Schwellen. */
export const GAP_MIN_PCT = 5
export const RVOL_MIN = 1.5
export const GAP_MEDIAN_FAKTOR = 2

/** Earnings-Vorlauf: Tage bis zum Termin. */
export const EARNINGS_VORLAUF_MIN = 3
export const EARNINGS_VORLAUF_MAX = 14

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

export function momentumPlaybookLabel(playbook: string): string {
  if (playbook === 'earnings_gap_fade') return 'Earnings-Gap-Fade'
  if (playbook === 'earnings_vorlauf') return 'Earnings-Vorlauf'
  if (playbook === 'earnings_momentum') return 'Earnings-Momentum'
  if (playbook === 'ipo_fade') return 'IPO-Fade'
  return playbook
}
