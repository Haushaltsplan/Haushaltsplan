/**
 * Wertentwicklung: Portfoliowert vs. zugeführtes Kapital (Parqet-Dashboard).
 */

import { depotStandBisDatum, depotStandProTag, einstandWertpapiereEur } from '@/lib/portfolio-analyse/bestand'
import { baueMonatsVerlauf } from '@/lib/portfolio-analyse/depot-berechnung'
import { hatExterneDepotEinAus } from '@/lib/portfolio-analyse/parqet-xirr'
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

/** Netto-Einzahlungen über die Depot-Grenze (nur wenn Deposit/Withdrawal im Import). */
function kapitalDeltaExtern(b: PortfolioBuchung): number {
  if (b.typ === 'einzahlung') return b.betragEur
  if (b.typ === 'auszahlung') return -b.betragEur
  return 0
}

/** Kumuliertes zugeführtes Kapital je Tag (Treppenkurve, Forward-Fill über `tage`). */
export function zugefuehrtKumuliertProTag(
  buchungen: PortfolioBuchung[],
  tage: string[],
): number[] {
  const extern = hatExterneDepotEinAus(buchungen)

  if (extern) {
    const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
    const byDay = new Map<string, number>()
    let sum = 0
    for (const b of sortiert) {
      sum += kapitalDeltaExtern(b)
      byDay.set(b.datum, round2(sum))
    }
    let stand = 0
    return tage.map((tag) => {
      if (byDay.has(tag)) stand = byDay.get(tag)!
      return stand
    })
  }

  // Parqet ohne Depot-Einzahlungen: Einstand offener Positionen (= „Investiert“), nicht Brutto-Käufe
  const standProTag = depotStandProTag(buchungen, tage)
  return tage.map((tag) => einstandWertpapiereEur(standProTag.get(tag)!))
}

/** Kumuliertes zugeführtes Kapital je Monat (Treppenkurve). */
function zugefuehrtProMonat(buchungen: PortfolioBuchung[]): Map<string, number> {
  const extern = hatExterneDepotEinAus(buchungen)

  if (extern) {
    const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
    const byMonth = new Map<string, number>()
    let sum = 0
    for (const b of sortiert) {
      sum += kapitalDeltaExtern(b)
      const k = b.datum.slice(0, 7)
      if (k) byMonth.set(k, round2(sum))
    }
    return byMonth
  }

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const monate = [...new Set(sortiert.map((b) => b.datum.slice(0, 7)).filter(Boolean))].sort()
  const byMonth = new Map<string, number>()
  for (const monat of monate) {
    const stand = depotStandBisDatum(buchungen, monatsEndeIso(monat))
    byMonth.set(monat, einstandWertpapiereEur(stand))
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
