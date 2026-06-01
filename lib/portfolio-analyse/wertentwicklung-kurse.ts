/**
 * Wertentwicklung mit echten Kursen (Yahoo-Historie, täglich).
 */

import { depotStandProTag } from '@/lib/portfolio-analyse/bestand'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { FxKurse } from '@/lib/portfolio-analyse/kurs-aufloesung'
import { preisInEur } from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import {
  achsenLabelIndizes,
  alleKalendertage,
  forwardFillKurse,
  heuteIso,
  tagLabel,
} from '@/lib/portfolio-analyse/wertentwicklung-tage'
import {
  baueWertentwicklung,
  zugefuehrtKumuliertProTag,
  type WertentwicklungPunkt,
} from '@/lib/portfolio-analyse/wertentwicklung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function kursEurAusNative(
  native: number,
  sym: string,
  isin: string,
  fx: FxKurse,
): number | null {
  if (!Number.isFinite(native) || native <= 0) return null
  const kenntnis = isinKenntnis(isin)
  return preisInEur(native, sym, fx, kenntnis?.symbolWaehrung?.[sym])
}

export function baueWertentwicklungTaeglichFallback(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
): WertentwicklungPunkt[] {
  const monatlich = baueWertentwicklung(buchungen, depotwertHeute)
  if (monatlich.length === 0) return []

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const von = sortiert[0].datum
  const bis = heuteIso()
  const tage = alleKalendertage(von, bis)
  const portByMonth = new Map(monatlich.map((p) => [p.monat, p.portfoliowertEur]))
  const kapital = zugefuehrtKumuliertProTag(buchungen, tage)
  const labelIdx = achsenLabelIndizes(tage)

  let lastPort = monatlich[0].portfoliowertEur
  return tage.map((datumIso, i) => {
    const m = datumIso.slice(0, 7)
    if (portByMonth.has(m)) lastPort = portByMonth.get(m)!
    const portfoliowertEur = datumIso === bis ? round2(depotwertHeute) : round2(lastPort)
    return {
      monat: m,
      datumIso,
      label: labelIdx.has(i) ? tagLabel(datumIso) : '',
      portfoliowertEur,
      zugefuehrtEur: kapital[i],
    }
  })
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
 * Tägliche Wertentwicklung mit MTM-Kursen; Fallback auf monatliche Kostenschätzung (täglich interpoliert).
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
  const von = sortiert[0].datum
  const bis = heuteIso()
  const tage = alleKalendertage(von, bis)

  if (historie.size === 0) {
    return baueWertentwicklungTaeglichFallback(buchungen, depotwertHeute)
  }

  const standProTag = depotStandProTag(buchungen, tage)
  const kapital = zugefuehrtKumuliertProTag(buchungen, tage)
  const posByIsin = new Map(positionen.map((p) => [p.isin?.toUpperCase() ?? '', p]))
  const labelIdx = achsenLabelIndizes(tage)

  const kursFill = new Map<string, number[]>()
  for (const [sym, serie] of historie) {
    kursFill.set(sym, forwardFillKurse(serie, tage))
  }

  const punkte: WertentwicklungPunkt[] = []

  for (let i = 0; i < tage.length; i++) {
    const datumIso = tage[i]
    const stand = standProTag.get(datumIso)!
    let wert = Math.max(0, stand.cash)

    for (const [isin, h] of stand.byIsin) {
      const pos = posByIsin.get(isin)
      const sym = pos?.symbolYahoo?.trim().toUpperCase() ?? null
      const einstand =
        h.einstandKurs > 0
          ? h.einstandKurs
          : (pos?.stueck ?? 0) > 0
            ? pos!.einstandEur / pos!.stueck
            : 0

      let kurs = einstand
      if (sym && !sym.startsWith('STOOQ:')) {
        const fills = kursFill.get(sym)
        const native = fills?.[i]
        if (native != null && Number.isFinite(native)) {
          const eur = kursEurAusNative(native, sym, isin, fx)
          if (eur != null && eur > 0) kurs = eur
        }
      }
      if (kurs > 0) wert += h.stueck * kurs
    }

    let portfoliowertEur = round2(wert)
    if (datumIso === bis) portfoliowertEur = round2(depotwertHeute)

    punkte.push({
      monat: datumIso.slice(0, 7),
      datumIso,
      label: labelIdx.has(i) ? tagLabel(datumIso) : '',
      portfoliowertEur,
      zugefuehrtEur: kapital[i],
    })
  }

  return punkte
}
