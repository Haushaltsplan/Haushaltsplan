/**
 * Parqet „% Performance“: Time-Weighted Rate of Return (TTWROR).
 *
 * r_t = V_t / (V_{t-1} + CF_t) − 1
 * Performance_T = (∏(1 + r_t) − 1) × 100
 *
 * CF_t = externer Kapitalzufluss am Tag t (Einzahlung/Auszahlung oder Δ zugeführt).
 */

import { hatExterneDepotEinAus } from '@/lib/portfolio-analyse/parqet-xirr'
import { buchungZaehltFuerParqetRealisiert } from '@/lib/portfolio-analyse/parqet-realisiert'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { tagLabel } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type PerformanceZeitPunkt = {
  datumIso: string
  label: string
  /** Kumulierte TTWROR seit erstem Kapitaltag in % (0 % am Start). */
  performanceProzent: number
}

const MIN_DENOMINATOR_EUR = 0.01
const MAX_ABS_DAILY_RETURN = 0.99

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clampDailyReturn(r: number): number {
  if (!Number.isFinite(r)) return 0
  if (r < -MAX_ABS_DAILY_RETURN) return 0
  if (r > 10) return 0
  return r
}

/** Externe Ein-/Auszahlungen über die Depotgrenze (Parqet Deposit/Withdrawal). */
function externerCashflowAmTag(buchungen: PortfolioBuchung[], datumIso: string): number {
  let sum = 0
  for (const b of buchungen) {
    if (b.datum !== datumIso) continue
    if (b.typ === 'einzahlung') sum += b.betragEur
    else if (b.typ === 'auszahlung') sum -= b.betragEur
  }
  return sum
}

function ertraegeAmTag(buchungen: PortfolioBuchung[], datumIso: string): number {
  let sum = 0
  for (const b of buchungen) {
    if (b.datum !== datumIso) continue
    if (b.typ === 'dividende' || b.typ === 'zins') sum += b.betragEur
    else if (buchungZaehltFuerParqetRealisiert(b)) sum += b.realisierterGewinnEur ?? 0
  }
  return sum
}

/** Dividenden/Zinsen erhöhen zugeführtes Kapital (Cash) — für TTWROR mit Erträgen aus CF herausrechnen. */
function dividendenZinsCashflowNeutralisierung(buchungen: PortfolioBuchung[], datumIso: string): number {
  let sum = 0
  for (const b of buchungen) {
    if (b.datum !== datumIso) continue
    if (b.typ === 'dividende' || b.typ === 'zins') sum += b.betragEur
  }
  return sum
}

/**
 * Netto-Kapitalzufluss am Tag t (positiv = Kauf/Einzahlung).
 * Im Handels-Modus: Δ zugeführtes Kapital (Käufe/Verkäufe neutralisieren die Tagesrendite).
 */
function cashflowAmTag(
  buchungen: PortfolioBuchung[],
  prev: WertentwicklungPunkt,
  cur: WertentwicklungPunkt,
  extern: boolean,
  mitDivUndRealisiert: boolean,
): number {
  if (extern) return externerCashflowAmTag(buchungen, cur.datumIso)
  let cf = cur.zugefuehrtEur - prev.zugefuehrtEur
  if (mitDivUndRealisiert) {
    cf -= dividendenZinsCashflowNeutralisierung(buchungen, cur.datumIso)
  }
  return cf
}

export function berechnePerformanceZeitreihe(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  mitDivUndRealisiert: boolean,
): PerformanceZeitPunkt[] {
  if (wertentwicklung.length === 0) return []

  const extern = hatExterneDepotEinAus(buchungen)
  const out: PerformanceZeitPunkt[] = []
  let cumulativeMultiplier = 1
  let hasStarted = false

  for (let i = 0; i < wertentwicklung.length; i++) {
    const cur = wertentwicklung[i]
    const label = cur.label || tagLabel(cur.datumIso)

    if (!hasStarted) {
      out.push({ datumIso: cur.datumIso, label, performanceProzent: 0 })
      if (cur.zugefuehrtEur > MIN_DENOMINATOR_EUR) {
        hasStarted = true
      }
      continue
    }

    const prev = wertentwicklung[i - 1]
    const cf = cashflowAmTag(buchungen, prev, cur, extern, mitDivUndRealisiert)

    let endValue = cur.portfoliowertEur
    if (!mitDivUndRealisiert) {
      endValue -= ertraegeAmTag(buchungen, cur.datumIso)
    }

    const denominator = prev.portfoliowertEur + cf

    let dailyReturn = 0
    if (denominator > MIN_DENOMINATOR_EUR && endValue >= 0) {
      dailyReturn = endValue / denominator - 1
    }

    dailyReturn = clampDailyReturn(dailyReturn)
    cumulativeMultiplier *= 1 + dailyReturn

    out.push({
      datumIso: cur.datumIso,
      label,
      performanceProzent: round2((cumulativeMultiplier - 1) * 100),
    })
  }

  return out
}
