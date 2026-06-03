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
const MIN_PORTFOLIO_EUR = 1

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Glättet offensichtliche API-Ausreißer (Portfoliowert ≈ 0 bei positivem Kapital).
 * LOCF auf Portfoliowert, wenn zugeführt deutlich höher ist.
 */
export function sanitiereWertentwicklungTimeline(
  punkte: WertentwicklungPunkt[],
): WertentwicklungPunkt[] {
  if (punkte.length === 0) return []

  const out: WertentwicklungPunkt[] = []
  let lastPlausible = 0

  for (const p of punkte) {
    const kapital = p.zugefuehrtEur
    let portfoliowert = Math.max(0, p.portfoliowertEur)

    const hatKapital = kapital > MIN_KAPITAL_EUR
    const plausibel =
      portfoliowert >= MIN_PORTFOLIO_EUR &&
      (!hatKapital || portfoliowert >= kapital * 0.02)

    if (plausibel) {
      lastPlausible = portfoliowert
    } else if (lastPlausible > 0 && hatKapital) {
      portfoliowert = lastPlausible
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
  const wertentwicklung = sanitiereWertentwicklungTimeline(wertentwicklungRoh)

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
