/**
 * Zentrale Dashboard-Pipeline: Wertentwicklung → Performance (TTWROR) → Drawdown.
 * Alle Charts nutzen dieselbe lückenlose Wertentwicklungs-Timeline als Basis.
 */

import { berechnePerformanceZeitreihe, type PerformanceZeitPunkt } from '@/lib/portfolio-analyse/performance-zeitreihe'
import {
  berechnePortfolioMetrikZeitreihe,
  type MetrikZeitPunkt,
} from '@/lib/portfolio-analyse/portfolio-metrik-zeitreihe'
import { PortfolioMetric } from '@/lib/portfolio-analyse/portfolio-metric'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { berechneDrawdown, type DrawdownStatistik } from '@/lib/portfolio-analyse/zeitreihen'

export type PortfolioBerechnungenOptionen = {
  mitDivUndRealisiert?: boolean
  portfolioMetric?: PortfolioMetric
}

export type PortfolioDashboardBerechnungen = {
  /** Schritt 1: lückenlose Tages-Timeline (bereits mit Kursen/LOCF befüllt). */
  wertentwicklung: WertentwicklungPunkt[]
  /** Schritt 2: TTWROR in % (oder gewählte Metrik). */
  performance: MetrikZeitPunkt[]
  performanceTtwror: PerformanceZeitPunkt[]
  /** Schritt 3: Drawdown vom Portfoliowert-ATH, ∈ [−100 %, 0 %]. */
  drawdown: DrawdownStatistik
}

const MIN_KAPITAL_EUR = 0.01
const MIN_PORTFOLIO_EUR = 0.01
/** Ein-Tages-Einbruch > 95 % bei gleichbleibendem Kapital → API-Lücke (LOCF). */
const CLIFF_RATIO = 0.05

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * LOCF auf Portfoliowert bei 0-/Klippen-Ausreißern (API-Lücken), ohne echte Verluste zu verfälschen.
 */
export function sanitiereWertentwicklungTimeline(
  punkte: WertentwicklungPunkt[],
): WertentwicklungPunkt[] {
  if (punkte.length === 0) return []

  const out: WertentwicklungPunkt[] = []
  let lastOk = 0

  for (const p of punkte) {
    const kapital = p.zugefuehrtEur
    let portfoliowert = p.portfoliowertEur
    const hatKapital = kapital > MIN_KAPITAL_EUR

    if (hatKapital && portfoliowert < MIN_PORTFOLIO_EUR && lastOk > kapital * 0.15) {
      portfoliowert = lastOk
    } else if (
      hatKapital &&
      lastOk > kapital * 0.15 &&
      portfoliowert > MIN_PORTFOLIO_EUR &&
      portfoliowert < lastOk * CLIFF_RATIO &&
      kapital >= lastOk * 0.4
    ) {
      portfoliowert = lastOk
    }

    if (portfoliowert >= kapital * 0.15 || portfoliowert >= lastOk * 0.5) {
      lastOk = Math.max(lastOk, portfoliowert)
    }

    out.push({
      ...p,
      portfoliowertEur: round2(portfoliowert),
      differenzEur: round2(portfoliowert - kapital),
    })
  }

  return out
}

/**
 * Sequenzielle Pipeline für Wertentwicklung-, Performance- und Drawdown-Charts.
 */
export function berechnePortfolioDashboardBerechnungen(
  wertentwicklungRoh: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  optionen: PortfolioBerechnungenOptionen = {},
): PortfolioDashboardBerechnungen {
  const wertentwicklung =
    wertentwicklungRoh.length > 0
      ? sanitiereWertentwicklungTimeline(wertentwicklungRoh)
      : []

  if (wertentwicklung.length === 0) {
    return {
      wertentwicklung: [],
      performance: [],
      performanceTtwror: [],
      drawdown: {
        serie: [],
        maxDrawdownProzent: 0,
        maxDrawdownTage: null,
        maxDrawdownPeriode: null,
      },
    }
  }

  const mitDiv = optionen.mitDivUndRealisiert ?? true
  const metric = optionen.portfolioMetric ?? PortfolioMetric.TTWROR

  const performanceTtwror = berechnePerformanceZeitreihe(wertentwicklung, buchungen, mitDiv)
  const performance = berechnePortfolioMetrikZeitreihe(metric, wertentwicklung, buchungen, {
    mitDivUndRealisiert: mitDiv,
  })
  const drawdown = berechneDrawdown(wertentwicklung)

  return {
    wertentwicklung,
    performance,
    performanceTtwror,
    drawdown,
  }
}
