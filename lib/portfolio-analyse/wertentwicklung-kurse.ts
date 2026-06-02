/**
 * Wertentwicklung mit echten Kursen (Yahoo-Historie, täglich).
 */

import { depotStandProTag } from '@/lib/portfolio-analyse/bestand'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { kandidatenMitDeFallback } from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { FxKurse } from '@/lib/portfolio-analyse/kurs-aufloesung'
import { preisInEur } from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import { symboleAusMeta } from '@/lib/portfolio-analyse/live-bewertung'
import type { PortfolioPositionSnapshot } from '@/lib/portfolio-analyse/types'
import {
  achsenLabelIndizes,
  alleKalendertage,
  forwardFillKurseBidirektional,
  heuteIso,
  tagLabel,
} from '@/lib/portfolio-analyse/wertentwicklung-tage'
import {
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

function kandidatenFuerIsin(
  isin: string,
  pos: PortfolioPositionSnapshot | undefined,
  meta: Map<string, IsinMetadata>,
): string[] {
  const yahoo = pos && 'symbolYahoo' in pos ? (pos as LivePosition).symbolYahoo : null
  const m = meta.get(isin)
  const k = isinKenntnis(isin)
  const basis = k?.symbolCandidates?.length
    ? k.symbolCandidates
    : m?.symbolCandidates?.length
      ? m.symbolCandidates
      : yahoo
        ? [yahoo]
        : m?.symbolYahoo
          ? [m.symbolYahoo]
          : []
  const mitDe = k?.kursNurSymbol ? [k.kursNurSymbol, ...basis] : kandidatenMitDeFallback(basis)
  const verboten = new Set((k?.verboteneSymbole ?? []).map((s) => s.toUpperCase()))
  return [...new Set(mitDe.map((s) => s.trim().toUpperCase()).filter((s) => s && !verboten.has(s)))]
}

/** Alle ISINs mit Kauf/Verkauf — auch verkaufte (für 2022-Verlauf). */
function positionenFuerKurshistorie(
  buchungen: PortfolioBuchung[],
  livePositionen: LivePosition[],
): PortfolioPositionSnapshot[] {
  const liveByIsin = new Map(
    livePositionen
      .filter((p) => p.isin)
      .map((p) => [p.isin!.toUpperCase(), p] as const),
  )
  const isins = new Set<string>()
  for (const b of buchungen) {
    if (!b.isin) continue
    if (b.typ === 'kauf' || b.typ === 'verkauf') isins.add(b.isin.toUpperCase())
  }
  const out: PortfolioPositionSnapshot[] = []
  for (const isin of isins) {
    const live = liveByIsin.get(isin)
    if (live) {
      out.push(live)
      continue
    }
    const name =
      buchungen.find((b) => b.isin?.toUpperCase() === isin && b.wertpapierName?.trim())?.wertpapierName?.trim() ??
      isin
    out.push({
      isin,
      name,
      stueck: 0,
      kursEur: 0,
      wertEur: 0,
      assetKlasse: 'aktie',
    })
  }
  return out
}

/** Symbol mit der längsten Yahoo-Historie je ISIN. */
function historieSymbolJeIsin(
  positionen: PortfolioPositionSnapshot[],
  meta: Map<string, IsinMetadata>,
  historie: Map<string, Map<string, number>>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin?.toUpperCase()
    if (!isin) continue
    let bestSym: string | null = null
    let bestLen = 0
    for (const sym of kandidatenFuerIsin(isin, p, meta)) {
      if (sym.startsWith('STOOQ:')) continue
      const serie = historie.get(sym)
      const len = serie?.size ?? 0
      if (len > bestLen) {
        bestLen = len
        bestSym = sym
      }
    }
    if (bestSym) map.set(isin, bestSym)
  }
  return map
}

/** Skaliert auf Live-Endwert, Tagesrenditen bleiben erhalten. */
function kalibriereAufEndwert(punkte: WertentwicklungPunkt[], depotwertHeute: number): WertentwicklungPunkt[] {
  if (punkte.length === 0) return []
  const last = punkte[punkte.length - 1].portfoliowertEur
  if (last <= 0) return punkte
  const f = depotwertHeute / last
  if (Math.abs(f - 1) < 0.0001) {
    punkte[punkte.length - 1].portfoliowertEur = round2(depotwertHeute)
    return punkte
  }
  return punkte.map((p, i) => ({
    ...p,
    portfoliowertEur: round2(i === punkte.length - 1 ? depotwertHeute : p.portfoliowertEur * f),
  }))
}

/** Alle Yahoo-Symbole für Historien-API (inkl. verkaufter Titel). */
export function yahooSymboleFuerHistorie(
  buchungen: PortfolioBuchung[],
  livePositionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): string[] {
  const alle = positionenFuerKurshistorie(buchungen, livePositionen)
  return symboleAusMeta(alle, meta).filter((s) => !s.startsWith('STOOQ:'))
}

/**
 * Tägliche MTM-Wertentwicklung — nur echte Marktkurse (kein Einstand-Fallback).
 */
export function baueWertentwicklungMitKursen(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
  positionen: LivePosition[],
  historie: Map<string, Map<string, number>>,
  fx: FxKurse,
  meta: Map<string, IsinMetadata> = new Map(),
): WertentwicklungPunkt[] {
  if (buchungen.length === 0 || historie.size === 0) return []

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const von = sortiert[0].datum
  const bis = heuteIso()
  const tage = alleKalendertage(von, bis)

  const standProTag = depotStandProTag(buchungen, tage)
  const kapital = zugefuehrtKumuliertProTag(buchungen, tage)
  const allePositionen = positionenFuerKurshistorie(buchungen, positionen)
  const symJeIsin = historieSymbolJeIsin(allePositionen, meta, historie)
  const labelIdx = achsenLabelIndizes(tage)

  const kursFill = new Map<string, number[]>()
  for (const sym of new Set(symJeIsin.values())) {
    const serie = historie.get(sym)
    if (serie) kursFill.set(sym, forwardFillKurseBidirektional(serie, tage))
  }

  const lastKursEur = new Map<string, number>()
  const punkte: WertentwicklungPunkt[] = []

  for (let i = 0; i < tage.length; i++) {
    const datumIso = tage[i]
    const stand = standProTag.get(datumIso)!
    let wert = Math.max(0, stand.cash)

    for (const [isin, h] of stand.byIsin) {
      if (h.stueck <= 0) continue
      const sym = symJeIsin.get(isin)
      let kursEur: number | null = null

      if (sym) {
        const fills = kursFill.get(sym)
        const native = fills?.[i]
        if (native != null && Number.isFinite(native) && native > 0) {
          kursEur = kursEurAusNative(native, sym, isin, fx)
        }
      }

      if (kursEur != null && kursEur > 0) {
        lastKursEur.set(isin, kursEur)
      } else {
        kursEur = lastKursEur.get(isin) ?? null
      }

      if (kursEur != null && kursEur > 0) wert += h.stueck * kursEur
    }

    punkte.push({
      monat: datumIso.slice(0, 7),
      datumIso,
      label: labelIdx.has(i) ? tagLabel(datumIso) : '',
      portfoliowertEur: round2(wert),
      zugefuehrtEur: kapital[i],
    })
  }

  return kalibriereAufEndwert(punkte, depotwertHeute)
}
