/**
 * Wertentwicklung mit echten Kursen (Yahoo-Historie, monatlich).
 */

import { depotStandBisDatum } from '@/lib/portfolio-analyse/bestand'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { FxKurse } from '@/lib/portfolio-analyse/kurs-aufloesung'
import { preisInEur } from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import {
  baueWertentwicklung,
  type WertentwicklungPunkt,
} from '@/lib/portfolio-analyse/wertentwicklung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function monatsEndeIso(monat: string): string {
  const [y, m] = monat.split('-').map(Number)
  const d = new Date(y, m, 0)
  const tag = String(d.getDate()).padStart(2, '0')
  return `${y}-${String(m).padStart(2, '0')}-${tag}`
}

function monatsLabel(monat: string): string {
  const [y, m] = monat.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function alleMonateZwischen(von: string, bis: string): string[] {
  const [y0, m0] = von.split('-').map(Number)
  const [y1, m1] = bis.split('-').map(Number)
  const out: string[] = []
  let y = y0
  let m = m0
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

function kursEurAmMonat(
  symbol: string | null,
  isin: string,
  monat: string,
  historie: Map<string, Map<string, number>>,
  fx: FxKurse,
  einstandKurs: number,
): number {
  if (symbol && !symbol.toUpperCase().startsWith('STOOQ:')) {
    const sym = symbol.toUpperCase()
    const serie = historie.get(sym)
    let native = serie?.get(monat) ?? null
    if (native == null && serie) {
      const keys = [...serie.keys()].sort()
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i] <= monat) {
          native = serie.get(keys[i])!
          break
        }
      }
    }
    if (native != null && native > 0) {
      const kenntnis = isinKenntnis(isin)
      const eur = preisInEur(native, sym, fx, kenntnis?.symbolWaehrung?.[sym])
      if (eur != null && eur > 0) return eur
    }
  }
  return einstandKurs > 0 ? einstandKurs : 0
}

function depotwertAmMonat(
  buchungen: PortfolioBuchung[],
  monat: string,
  positionen: LivePosition[],
  historie: Map<string, Map<string, number>>,
  fx: FxKurse,
): number {
  const bis = monatsEndeIso(monat)
  const stand = depotStandBisDatum(buchungen, bis)
  let wert = Math.max(0, stand.cash)

  const posByIsin = new Map(positionen.map((p) => [p.isin?.toUpperCase() ?? '', p]))

  for (const [isin, h] of stand.byIsin) {
    const pos = posByIsin.get(isin)
    const sym = pos?.symbolYahoo ?? null
    const einstand = h.einstandKurs > 0 ? h.einstandKurs : (pos?.stueck ?? 0) > 0 ? pos!.einstandEur / pos!.stueck : 0
    const kurs = kursEurAmMonat(sym, isin, monat, historie, fx, einstand)
    if (kurs > 0) wert += h.stueck * kurs
    else if (einstand > 0) wert += h.stueck * einstand
  }

  return round2(wert)
}

/** Yahoo-Symbole für Historie (ohne Stooq). */
export function yahooSymboleFuerHistorie(positionen: LivePosition[]): string[] {
  return [
    ...new Set(
      positionen
        .map((p) => p.symbolYahoo?.trim().toUpperCase())
        .filter((s): s is string => !!s && !s.startsWith('STOOQ:')),
    ),
  ]
}

/**
 * Wertentwicklung mit MTM-Kursen; Fallback auf Kostenschätzung wenn Historie leer.
 */
export function baueWertentwicklungMitKursen(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
  positionen: LivePosition[],
  historie: Map<string, Map<string, number>>,
  fx: FxKurse,
): WertentwicklungPunkt[] {
  if (buchungen.length === 0) return []

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const vonMonat = sortiert[0].datum.slice(0, 7)
  const jetzt = new Date()
  const bisMonat = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}`

  if (historie.size === 0) {
    return baueWertentwicklung(buchungen, depotwertHeute)
  }

  const kapitalBasis = baueWertentwicklung(buchungen, depotwertHeute)
  const kapitalMap = new Map(kapitalBasis.map((p) => [p.monat, p.zugefuehrtEur]))

  const monate = alleMonateZwischen(vonMonat, bisMonat)
  const punkte: WertentwicklungPunkt[] = []

  let kapitalStand = 0
  for (const monat of monate) {
    if (kapitalMap.has(monat)) kapitalStand = kapitalMap.get(monat)!
    let portfoliowert = depotwertAmMonat(buchungen, monat, positionen, historie, fx)
    if (monat === bisMonat) {
      portfoliowert = round2(depotwertHeute)
    }
    punkte.push({
      monat,
      label: monatsLabel(monat),
      datumIso: monatsEndeIso(monat),
      portfoliowertEur: portfoliowert,
      zugefuehrtEur: kapitalStand,
    })
  }

  return punkte
}
