/**
 * Kumulierte Portfolio-Performance (TWR) für Parqet-% Chart.
 */

import { hatExterneDepotEinAus } from '@/lib/portfolio-analyse/parqet-xirr'
import { buchungZaehltFuerParqetRealisiert } from '@/lib/portfolio-analyse/parqet-realisiert'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { tagLabel } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type PerformanceZeitPunkt = {
  datumIso: string
  label: string
  /** Kumulierte TWR seit Start in % (0 = Start). */
  performanceProzent: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function externerZuflussAmTag(buchungen: PortfolioBuchung[], datumIso: string): number {
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

/**
 * Tägliche kumulierte Rendite (TWR-Index ab 100).
 * Kapitalzuflüsse werden neutralisiert (Depot-Ein/Aus oder Δ „zugeführt“).
 */
export function berechnePerformanceZeitreihe(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  mitDivUndRealisiert: boolean,
): PerformanceZeitPunkt[] {
  if (wertentwicklung.length < 2) return []

  const extern = hatExterneDepotEinAus(buchungen)
  let twrIndex = 100

  const out: PerformanceZeitPunkt[] = [
    {
      datumIso: wertentwicklung[0].datumIso,
      label: wertentwicklung[0].label || tagLabel(wertentwicklung[0].datumIso),
      performanceProzent: 0,
    },
  ]

  for (let i = 1; i < wertentwicklung.length; i++) {
    const prev = wertentwicklung[i - 1]
    const cur = wertentwicklung[i]
    const v0 = prev.portfoliowertEur
    const v1 = cur.portfoliowertEur

    let cf = 0
    if (extern) {
      cf = externerZuflussAmTag(buchungen, cur.datumIso)
    } else {
      cf = cur.zugefuehrtEur - prev.zugefuehrtEur
    }

    let gain = v1 - v0 - cf
    if (mitDivUndRealisiert) {
      gain += ertraegeAmTag(buchungen, cur.datumIso)
    }

    const r = v0 > 0 ? gain / v0 : 0
    twrIndex *= 1 + r

    out.push({
      datumIso: cur.datumIso,
      label: cur.label || tagLabel(cur.datumIso),
      performanceProzent: round2(twrIndex - 100),
    })
  }

  return out
}
