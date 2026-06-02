/**
 * Wertentwicklung: Portfoliowert vs. zugeführtes Kapital (Parqet-Dashboard).
 */

import {
  depotStandBisDatum,
  depotStandProTag,
  einstandWertpapiereEur,
  type DepotStand,
} from '@/lib/portfolio-analyse/bestand'
import { baueMonatsVerlauf } from '@/lib/portfolio-analyse/depot-berechnung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

export type WertentwicklungPunkt = {
  /** YYYY-MM – Gruppierung / Legacy-Charts */
  monat: string
  /** Achsenbeschriftung (nur an markierten Stellen gesetzt) */
  label: string
  /** ISO YYYY-MM-DD (Stichtag) */
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

/** Parqet „zugeführt“ / Investiert am Stichtag (Einstand + Cash). */
function zugefuehrtAmDepotStand(stand: DepotStand): number {
  return round2(einstandWertpapiereEur(stand) + Math.max(0, stand.cash))
}

/** Zugeführtes Kapital je Tag (Parqet-Kurve: Einstand + Cash). */
export function zugefuehrtKumuliertProTag(
  buchungen: PortfolioBuchung[],
  tage: string[],
): number[] {
  const standProTag = depotStandProTag(buchungen, tage)
  return tage.map((tag) => zugefuehrtAmDepotStand(standProTag.get(tag)!))
}

/** Zugeführtes Kapital je Monatsende (Parqet: Einstand + Cash). */
function zugefuehrtProMonat(buchungen: PortfolioBuchung[]): Map<string, number> {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const monate = [...new Set(sortiert.map((b) => b.datum.slice(0, 7)).filter(Boolean))].sort()
  const byMonth = new Map<string, number>()
  for (const monat of monate) {
    const stand = depotStandBisDatum(buchungen, monatsEndeIso(monat))
    byMonth.set(monat, round2(einstandWertpapiereEur(stand) + Math.max(0, stand.cash)))
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
