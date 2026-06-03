/**
 * Zeitreihen je Portfolio-Metrik (Performance-Dropdown).
 * Jede Metrik hat eigene Formeln — nicht vermischen.
 */

import { depotStandProTag, einstandWertpapiereEur } from '@/lib/portfolio-analyse/bestand'
import { dividendenZuflussEur } from '@/lib/portfolio-analyse/dividenden-buchung'
import { berechneIrrAnnualizedPercent } from '@/lib/portfolio-analyse/parqet-core/math-utils'
import { parqetIrrCashflowsAusBuchungen } from '@/lib/portfolio-analyse/parqet-xirr'
import { buchungZaehltFuerParqetRealisiert } from '@/lib/portfolio-analyse/parqet-realisiert'
import {
  metrikEinheit,
  PortfolioMetric,
  type MetrikEinheit,
} from '@/lib/portfolio-analyse/portfolio-metric'
import { berechnePerformanceZeitreihe } from '@/lib/portfolio-analyse/performance-zeitreihe'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { tagLabel } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type MetrikZeitPunkt = {
  datumIso: string
  label: string
  wert: number
  einheit: MetrikEinheit
}

export type MetrikZeitreiheOptionen = {
  /** Nur für TTWROR: Erträge am Zahltag aus Tagesrendite herausrechnen */
  mitDivUndRealisiert?: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function punkt(
  wertentwicklung: WertentwicklungPunkt,
  wert: number,
  einheit: MetrikEinheit,
): MetrikZeitPunkt {
  return {
    datumIso: wertentwicklung.datumIso,
    label: wertentwicklung.label || tagLabel(wertentwicklung.datumIso),
    wert: round2(wert),
    einheit,
  }
}

function kumulierteBetraegeProTag(
  buchungen: PortfolioBuchung[],
  tage: string[],
): { dividenden: number[]; realisiert: number[] } {
  const divByTag = new Map<string, number>()
  const realByTag = new Map<string, number>()

  for (const b of buchungen) {
    const zufluss = dividendenZuflussEur(b)
    if (zufluss > 0) {
      divByTag.set(b.datum, (divByTag.get(b.datum) ?? 0) + zufluss)
    }
    if (buchungZaehltFuerParqetRealisiert(b)) {
      realByTag.set(b.datum, (realByTag.get(b.datum) ?? 0) + (b.realisierterGewinnEur ?? 0))
    }
  }

  let kumDiv = 0
  let kumReal = 0
  const dividenden: number[] = []
  const realisiert: number[] = []

  for (const tag of tage) {
    kumDiv += divByTag.get(tag) ?? 0
    kumReal += realByTag.get(tag) ?? 0
    dividenden.push(round2(kumDiv))
    realisiert.push(round2(kumReal))
  }

  return { dividenden, realisiert }
}

function zeitreiheTtwror(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  mitDivUndRealisiert: boolean,
): MetrikZeitPunkt[] {
  const twr = berechnePerformanceZeitreihe(wertentwicklung, buchungen, mitDivUndRealisiert)
  return twr.map((p) => ({
    datumIso: p.datumIso,
    label: p.label,
    wert: p.performanceProzent,
    einheit: 'prozent' as const,
  }))
}

/**
 * Absoluter Ertrag: Vermögenszuwachs in €.
 * = Portfoliowert − Zugeführt (keine Doppelzählung von Div/Cash in beiden Größen).
 */
function zeitreiheAbsolut(wertentwicklung: WertentwicklungPunkt[]): MetrikZeitPunkt[] {
  return wertentwicklung.map((p) =>
    punkt(p, p.portfoliowertEur - p.zugefuehrtEur, 'eur'),
  )
}

/** Kursgewinn: Marktwert der Positionen − Einstand (ohne Cash, ohne Div/realisiert). */
function zeitreiheKursgewinn(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
): MetrikZeitPunkt[] {
  const tage = wertentwicklung.map((p) => p.datumIso)
  const standProTag = depotStandProTag(buchungen, tage)

  return wertentwicklung.map((p) => {
    const stand = standProTag.get(p.datumIso)!
    const einstand = einstandWertpapiereEur(stand)
    const kursgewinn = p.portfoliowertEur - einstand - Math.max(0, stand.cash)
    return punkt(p, kursgewinn, 'eur')
  })
}

function zeitreiheDividenden(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
): MetrikZeitPunkt[] {
  const tage = wertentwicklung.map((p) => p.datumIso)
  const { dividenden } = kumulierteBetraegeProTag(buchungen, tage)
  return wertentwicklung.map((p, i) => punkt(p, dividenden[i], 'eur'))
}

/** Kumulierte realisierte Gewinne — springt nur an Verkaufstagen. */
function zeitreiheRealisiert(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
): MetrikZeitPunkt[] {
  const tage = wertentwicklung.map((p) => p.datumIso)
  const { realisiert } = kumulierteBetraegeProTag(buchungen, tage)
  return wertentwicklung.map((p, i) => punkt(p, realisiert[i], 'eur'))
}

/** IZF bis Stichtag: Cashflows ≤ t, Terminal = Portfoliowert_t (annualisiert in %). */
function zeitreiheIrr(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
): MetrikZeitPunkt[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  let lastIrr = 0

  return wertentwicklung.map((p) => {
    const bis = sortiert.filter((b) => b.datum <= p.datumIso)
    const flows = parqetIrrCashflowsAusBuchungen(bis)
    const terminal = p.portfoliowertEur
    const datum = new Date(`${p.datumIso}T12:00:00`)
    const irr =
      flows.length >= 1 && terminal > 0
        ? berechneIrrAnnualizedPercent(flows, terminal, datum)
        : null

    if (irr != null && Number.isFinite(irr)) lastIrr = irr
    return punkt(p, irr ?? lastIrr, 'prozent')
  })
}

export function berechnePortfolioMetrikZeitreihe(
  metric: PortfolioMetric,
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  optionen: MetrikZeitreiheOptionen = {},
): MetrikZeitPunkt[] {
  if (wertentwicklung.length === 0) return []

  const mitDiv = optionen.mitDivUndRealisiert ?? true
  const einheit = metrikEinheit(metric)

  switch (metric) {
    case PortfolioMetric.TTWROR:
      return zeitreiheTtwror(wertentwicklung, buchungen, mitDiv)
    case PortfolioMetric.ABSOLUTE:
      return zeitreiheAbsolut(wertentwicklung)
    case PortfolioMetric.IRR:
      return zeitreiheIrr(wertentwicklung, buchungen)
    case PortfolioMetric.KURSGEWINN:
      return zeitreiheKursgewinn(wertentwicklung, buchungen)
    case PortfolioMetric.DIVIDENDEN:
      return zeitreiheDividenden(wertentwicklung, buchungen)
    case PortfolioMetric.REALISIERT:
      return zeitreiheRealisiert(wertentwicklung, buchungen)
    default:
      return wertentwicklung.map((p) => punkt(p, 0, einheit))
  }
}
