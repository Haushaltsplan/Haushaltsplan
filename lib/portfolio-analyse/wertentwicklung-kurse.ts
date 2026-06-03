/**
 * Wertentwicklung mit echten Kursen (Yahoo-Historie, täglich).
 */

import { depotStandProTag } from '@/lib/portfolio-analyse/bestand'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  FX_SYMBOLE,
  type FxKurse,
  boersenWaehrung,
  fxKurseAusYahooMap,
  kandidatenMitDeFallback,
  preisInEur,
} from '@/lib/portfolio-analyse/kurs-aufloesung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import { symboleAusMeta } from '@/lib/portfolio-analyse/live-bewertung'
import type { PortfolioPositionSnapshot } from '@/lib/portfolio-analyse/types'
import {
  achsenLabelIndizes,
  alleKalendertage,
  forwardFillKurse,
  heuteIso,
  tagLabel,
} from '@/lib/portfolio-analyse/wertentwicklung-tage'
import {
  zugefuehrtKumuliertProTag,
  type WertentwicklungPunkt,
} from '@/lib/portfolio-analyse/wertentwicklung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

const PLAUSIBEL_MIN = 0.15
const PLAUSIBEL_MAX = 5

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
  if (k?.kursNurSymbol) {
    return [k.kursNurSymbol.trim().toUpperCase()].filter(Boolean)
  }
  const basis = k?.symbolCandidates?.length
    ? k.symbolCandidates
    : m?.symbolCandidates?.length
      ? m.symbolCandidates
      : yahoo
        ? [yahoo]
        : m?.symbolYahoo
          ? [m.symbolYahoo]
          : []
  const mitDe = kandidatenMitDeFallback(basis)
  const verboten = new Set((k?.verboteneSymbole ?? []).map((s) => s.toUpperCase()))
  return [...new Set(mitDe.map((s) => s.trim().toUpperCase()).filter((s) => s && !verboten.has(s)))]
}

/** Alle ISINs mit Kauf/Verkauf — auch verkaufte (für historischen Verlauf). */
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

/** FX-Kurse je Tag aus Yahoo-Historie (Forward-Fill). */
function fxProTag(
  historie: Map<string, Map<string, number>>,
  tage: string[],
): FxKurse[] {
  const fallback = fxKurseAusYahooMap(new Map())
  const usd = forwardFillKurse(historie.get('EURUSD=X') ?? new Map(), tage)
  const gbp = forwardFillKurse(historie.get('EURGBP=X') ?? new Map(), tage)
  const chf = forwardFillKurse(historie.get('EURCHF=X') ?? new Map(), tage)
  const cad = forwardFillKurse(historie.get('EURCAD=X') ?? new Map(), tage)
  const sgd = forwardFillKurse(historie.get('EURSGD=X') ?? new Map(), tage)

  return tage.map((_, i) => ({
    eurUsd: Number.isFinite(usd[i]) && usd[i] > 0 ? usd[i] : fallback.eurUsd,
    eurGbp: Number.isFinite(gbp[i]) && gbp[i] > 0 ? gbp[i] : fallback.eurGbp,
    eurChf: Number.isFinite(chf[i]) && chf[i] > 0 ? chf[i] : fallback.eurChf,
    eurCad: Number.isFinite(cad[i]) && cad[i] > 0 ? cad[i] : fallback.eurCad,
    eurSgd: Number.isFinite(sgd[i]) && sgd[i] > 0 ? sgd[i] : fallback.eurSgd,
  }))
}

function letzterNativeKurs(serie: Map<string, number>): number | null {
  const keys = [...serie.keys()].sort()
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = serie.get(keys[i])
    if (v != null && v > 0) return v
  }
  return null
}

/** Gleiches Symbol wie Live-Bewertung (nicht „längste Historie“). */
function symbolJeIsin(
  isin: string,
  live: LivePosition | undefined,
  pos: PortfolioPositionSnapshot | undefined,
  meta: Map<string, IsinMetadata>,
  historie: Map<string, Map<string, number>>,
  referenzKurs: number,
  fx: FxKurse,
): string | null {
  const k = isinKenntnis(isin)
  if (k?.kursNurSymbol) {
    const sym = k.kursNurSymbol.toUpperCase()
    if (historie.get(sym)?.size) return sym
  }

  if (live?.symbolYahoo) {
    const sym = live.symbolYahoo.toUpperCase()
    if (historie.get(sym)?.size) return sym
  }

  const kandidaten = kandidatenFuerIsin(isin, live ?? pos, meta).filter((s) => !s.startsWith('STOOQ:'))
  const ref = referenzKurs > 0 ? referenzKurs : null

  type Hit = { sym: string; score: number }
  const hits: Hit[] = []

  for (const sym of kandidaten) {
    const serie = historie.get(sym)
    if (!serie?.size) continue
    const native = letzterNativeKurs(serie)
    if (native == null) continue
    const eur = kursEurAusNative(native, sym, isin, fx)
    if (eur == null) continue

    if (ref != null) {
      const ratio = eur / ref
      if (ratio < PLAUSIBEL_MIN || ratio > PLAUSIBEL_MAX) continue
    }

    let score = serie.size
    const w = boersenWaehrung(sym, k?.symbolWaehrung?.[sym])
    if (w === 'EUR') score += 1000
    else if (w === 'USD' && !sym.includes('.')) score += 100
    if (sym.endsWith('.DE') || sym.endsWith('.F')) score += 50
    if (ref != null && ref > 0) score += Math.max(0, 50 - Math.abs(Math.log(eur / ref)) * 20)

    hits.push({ sym, score })
  }

  if (hits.length === 0) {
    let best: { sym: string; len: number } | null = null
    for (const sym of kandidaten) {
      const len = historie.get(sym)?.size ?? 0
      if (len > (best?.len ?? 0)) best = { sym, len }
    }
    return best?.sym ?? null
  }

  hits.sort((a, b) => b.score - a.score)
  return hits[0].sym
}

/** Alle Yahoo-Symbole für Historien-API (inkl. verkaufter Titel + FX). */
export function yahooSymboleFuerHistorie(
  buchungen: PortfolioBuchung[],
  livePositionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): string[] {
  const alle = positionenFuerKurshistorie(buchungen, livePositionen)
  const wp = symboleAusMeta(alle, meta).filter((s) => !s.startsWith('STOOQ:'))
  return [...new Set([...wp, ...FX_SYMBOLE])]
}

/**
 * Tägliche MTM-Wertentwicklung (Parqet „Portfoliowert“-Linie).
 * Cash + Stück × Marktkurs; kein globales Skalieren, kein Backward-Fill.
 */
export function baueWertentwicklungMitKursen(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
  positionen: LivePosition[],
  historie: Map<string, Map<string, number>>,
  fxHeute: FxKurse,
  meta: Map<string, IsinMetadata> = new Map(),
): WertentwicklungPunkt[] {
  if (buchungen.length === 0 || historie.size === 0) return []

  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const von = sortiert[0].datum
  const bis = heuteIso()
  const tage = alleKalendertage(von, bis)
  const n = tage.length

  const standProTag = depotStandProTag(buchungen, tage)
  const kapital = zugefuehrtKumuliertProTag(buchungen, tage)
  const allePositionen = positionenFuerKurshistorie(buchungen, positionen)
  const liveByIsin = new Map(
    positionen.filter((p) => p.isin).map((p) => [p.isin!.toUpperCase(), p] as const),
  )
  const posByIsin = new Map(allePositionen.filter((p) => p.isin).map((p) => [p.isin!.toUpperCase(), p]))

  const fxTage = fxProTag(historie, tage)

  const symJeIsin = new Map<string, string>()
  for (const p of allePositionen) {
    const isin = p.isin?.toUpperCase()
    if (!isin) continue
    const live = liveByIsin.get(isin)
    const ref =
      live && live.stueck > 0
        ? live.einstandEur / live.stueck
        : (posByIsin.get(isin)?.kursEur ?? 0)
    const sym = symbolJeIsin(isin, live, p, meta, historie, ref, fxHeute)
    if (sym) symJeIsin.set(isin, sym)
  }

  const kursFillNative = new Map<string, number[]>()
  for (const sym of new Set(symJeIsin.values())) {
    const serie = historie.get(sym)
    if (serie) kursFillNative.set(sym, forwardFillKurse(serie, tage))
  }

  const labelIdx = achsenLabelIndizes(tage)
  const punkte: WertentwicklungPunkt[] = []

  for (let i = 0; i < n; i++) {
    const datumIso = tage[i]
    const stand = standProTag.get(datumIso)!
    const fx = fxTage[i]
    let wert = stand.cash

    for (const [isin, h] of stand.byIsin) {
      if (h.stueck <= 0) continue

      const live = liveByIsin.get(isin)
      let kursEur: number | null = null

      if (datumIso === bis && live?.kursLiveEur != null && live.kursLiveEur > 0) {
        kursEur = live.kursLiveEur
      } else {
        const sym = symJeIsin.get(isin)
        if (sym) {
          const fills = kursFillNative.get(sym)
          const native = fills?.[i]
          if (native != null && Number.isFinite(native) && native > 0) {
            kursEur = kursEurAusNative(native, sym, isin, fx)
          }
        }
        if (kursEur == null && h.einstandKurs > 0) {
          kursEur = h.einstandKurs
        }
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

  if (n > 0 && depotwertHeute > 0) {
    const last = punkte[n - 1]
    const diff = Math.abs(last.portfoliowertEur - depotwertHeute) / depotwertHeute
    if (diff > 0.02) {
      last.portfoliowertEur = round2(depotwertHeute)
    }
  }

  return punkte
}
