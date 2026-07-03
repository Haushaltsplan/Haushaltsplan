import 'server-only'

import {
  BACKTEST_MIN_SAMPLES_GLOBAL,
  MOMENTUM_DEFAULT_RISK_EUR,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  berechneErwartungswertR,
  berechneRewardRisk,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trade-qualitaet-server'
import type {
  MomentumPlaybookStat,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumPlanungsScore = {
  /** 0–100: 50 = break-even, höher = besser planbar */
  score: number
  label: string
  erwartungEur: number | null
  erwartungR: number | null
  basisText: string
}

/**
 * Planungs-Score für Priorisierung — basiert auf Erwartungswert (R) mit Backtest-Trefferquote,
 * nicht auf optimistischer Treffer-Schätzung.
 */
export function berechnePlanungsScore(
  e: MomentumScanEintrag,
  trefferPct: number,
  stat: MomentumPlaybookStat | null,
  istAktiv: boolean,
): MomentumPlanungsScore {
  const rr = berechneRewardRisk(e)
  const trefferFuerEv = stat?.trefferPct ?? trefferPct
  const evR = rr != null ? berechneErwartungswertR(trefferFuerEv, rr) : null
  const riskEur = MOMENTUM_DEFAULT_RISK_EUR

  let score: number
  if (evR != null) {
    score = 50 + evR * 40
  } else {
    score = 38 + trefferPct * 0.22
  }

  const n = stat?.sampleSize ?? 0
  let datenVertrauen: number
  if (n >= BACKTEST_MIN_SAMPLES_GLOBAL * 2) datenVertrauen = 1
  else if (n >= BACKTEST_MIN_SAMPLES_GLOBAL) datenVertrauen = 0.88
  else if (n >= 5) datenVertrauen = 0.72
  else if (n > 0) datenVertrauen = 0.55
  else datenVertrauen = 0.42

  score = 50 + (score - 50) * datenVertrauen

  if (!istAktiv) score = Math.min(score, 46)
  if (e.ampel === 'rot') score = Math.min(score, 38)
  if (e.indikatoren.playbookDeaktiviert === true) score = Math.min(score, 35)

  score = Math.round(Math.max(0, Math.min(100, score)))

  const label =
    score >= 62 ? 'Stark planbar' : score >= 54 ? 'Planbar' : score >= 46 ? 'Neutral' : 'Schwach'

  const erwartungEur = evR != null ? Math.round(evR * riskEur * 100) / 100 : null

  const basisParts: string[] = []
  if (evR != null && rr != null) {
    basisParts.push('EV ' + (evR >= 0 ? '+' : '') + evR + 'R (R/R ' + rr + ')')
    if (erwartungEur != null) {
      basisParts.push(
        '≈ ' + (erwartungEur >= 0 ? '+' : '') + erwartungEur + ' € bei ' + riskEur + ' € Risiko',
      )
    }
  }
  basisParts.push('Treffer ' + trefferFuerEv + '%' + (stat?.trefferPct != null ? ' (Backtest)' : ''))
  if (stat?.sampleSize) basisParts.push(n + ' historische Setups')

  return {
    score,
    label,
    erwartungEur,
    erwartungR: evR,
    basisText: basisParts.join(' · '),
  }
}
