/**
 * Parqet „% Performance“-Kurve: Rendite auf eingesetztes Kapital je Stichtag.
 *
 * Basis (wie Parqet-Chart „Rendite“):
 *   Performance % = (Portfoliowert − zugeführt) / zugeführt × 100
 * mit zugeführt = Einstand + Cash (siehe Wertentwicklung).
 *
 * Toggle „Dividenden und realisierte Gewinne inkludieren“:
 *   Zusätzlich kumulierte Dividenden/Zinsen + realisierte Gewinne im Zähler.
 */

import { buchungZaehltFuerParqetRealisiert } from '@/lib/portfolio-analyse/parqet-realisiert'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import { tagLabel } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type PerformanceZeitPunkt = {
  datumIso: string
  label: string
  /** Rendite auf eingesetztes Kapital in % (0 % = Break-even). */
  performanceProzent: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ertraegeProTagMap(buchungen: PortfolioBuchung[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const b of buchungen) {
    let delta = 0
    if (b.typ === 'dividende' || b.typ === 'zins') delta = b.betragEur
    else if (buchungZaehltFuerParqetRealisiert(b)) delta = b.realisierterGewinnEur ?? 0
    else continue
    byDay.set(b.datum, round2((byDay.get(b.datum) ?? 0) + delta))
  }
  return byDay
}

export function berechnePerformanceZeitreihe(
  wertentwicklung: WertentwicklungPunkt[],
  buchungen: PortfolioBuchung[],
  mitDivUndRealisiert: boolean,
): PerformanceZeitPunkt[] {
  if (wertentwicklung.length === 0) return []

  const ertraegeTag = ertraegeProTagMap(buchungen)
  let kumErtraege = 0

  return wertentwicklung.map((p) => {
    kumErtraege += ertraegeTag.get(p.datumIso) ?? 0
    kumErtraege = round2(kumErtraege)

    const z = p.zugefuehrtEur
    const v = p.portfoliowertEur + (mitDivUndRealisiert ? kumErtraege : 0)
    const performanceProzent = z > 0 ? round2(((v - z) / z) * 100) : 0

    return {
      datumIso: p.datumIso,
      label: p.label || tagLabel(p.datumIso),
      performanceProzent,
    }
  })
}
