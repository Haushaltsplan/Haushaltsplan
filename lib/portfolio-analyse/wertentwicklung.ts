/**
 * Wertentwicklung: Portfoliowert vs. zugeführtes Kapital (Parqet-Dashboard).
 */

import { baueMonatsVerlauf } from '@/lib/portfolio-analyse/depot-berechnung'
import { hatExterneDepotEinAus } from '@/lib/portfolio-analyse/parqet-xirr'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type WertentwicklungPunkt = {
  monat: string
  label: string
  /** ISO-Datum (Monatsende) für Tooltip */
  datumIso: string
  portfoliowertEur: number
  zugefuehrtEur: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function monatsEndeIso(monat: string): string {
  const [y, m] = monat.split('-').map(Number)
  const d = new Date(y, m, 0)
  const tag = String(d.getDate()).padStart(2, '0')
  return `${y}-${String(m).padStart(2, '0')}-${tag}`
}

/** Netto-Zufluss für „zugeführtes Kapital“ (extern oder Handel). */
function kapitalDelta(b: PortfolioBuchung, extern: boolean): number {
  if (extern) {
    if (b.typ === 'einzahlung') return b.betragEur
    if (b.typ === 'auszahlung') return -b.betragEur
    return 0
  }
  if (b.typ === 'kauf') return b.betragEur
  if (b.typ === 'verkauf') return -b.betragEur
  return 0
}

/** Kumuliertes zugeführtes Kapital je Monat (Treppenkurve). */
function zugefuehrtProMonat(buchungen: PortfolioBuchung[]): Map<string, number> {
  const extern = hatExterneDepotEinAus(buchungen)
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const byMonth = new Map<string, number>()
  let sum = 0
  for (const b of sortiert) {
    sum += kapitalDelta(b, extern)
    const k = b.datum.slice(0, 7)
    if (k) byMonth.set(k, round2(sum))
  }
  return byMonth
}

export function baueWertentwicklung(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
): WertentwicklungPunkt[] {
  const verlauf = baueMonatsVerlauf(buchungen, depotwertHeute)
  if (verlauf.length === 0) return []

  const kapitalMap = zugefuehrtProMonat(buchungen)
  let kapitalStand = 0

  return verlauf.map((p) => {
    if (kapitalMap.has(p.monat)) kapitalStand = kapitalMap.get(p.monat)!
    return {
      monat: p.monat,
      label: p.label,
      datumIso: monatsEndeIso(p.monat),
      portfoliowertEur: p.wert,
      zugefuehrtEur: kapitalStand,
    }
  })
}
