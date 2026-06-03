/**
 * Wertentwicklung mit echten Kursen (Yahoo-Historie, täglich).
 * Chronologisch: Bestand je Tag × LOCF-Kurs — kein Null-Klippen bei Datenlücken.
 */

import { depotStandProTag, einstandWertpapiereEur, type DepotStand } from '@/lib/portfolio-analyse/bestand'
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
  loecfWerte,
  tagLabel,
} from '@/lib/portfolio-analyse/wertentwicklung-tage'
import {
  zugefuehrtKumuliertProTag,
  type WertentwicklungPunkt,
} from '@/lib/portfolio-analyse/wertentwicklung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

const PLAUSIBEL_MIN = 0.08
const PLAUSIBEL_MAX = 12
const MIN_KURS_EUR = 1e-8

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

/** Alle ISINs, die jemals im Depot waren (Kauf/Verkauf). */
function alleIsinsAusBuchungen(buchungen: PortfolioBuchung[]): Set<string> {
  const isins = new Set<string>()
  for (const b of buchungen) {
    if (!b.isin) continue
    if (b.typ === 'kauf' || b.typ === 'verkauf') isins.add(b.isin.toUpperCase())
  }
  return isins
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
  const out: PortfolioPositionSnapshot[] = []
  for (const isin of alleIsinsAusBuchungen(buchungen)) {
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

function abdeckungTage(nativeFilled: number[]): number {
  return nativeFilled.filter((v) => Number.isFinite(v) && v > 0).length
}

/** Symbol mit maximaler LOCF-Abdeckung über den Chart-Zeitraum. */
function symbolMitBesteAbdeckung(
  isin: string,
  live: LivePosition | undefined,
  pos: PortfolioPositionSnapshot | undefined,
  meta: Map<string, IsinMetadata>,
  historie: Map<string, Map<string, number>>,
  tage: string[],
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

  type Hit = { sym: string; coverage: number; score: number }
  const hits: Hit[] = []

  for (const sym of kandidaten) {
    const serie = historie.get(sym)
    if (!serie?.size) continue
    const nativeFilled = forwardFillKurse(serie, tage)
    const coverage = abdeckungTage(nativeFilled)
    if (coverage === 0) continue

    const native = letzterNativeKurs(serie)
    if (native == null) continue
    const eur = kursEurAusNative(native, sym, isin, fx)
    if (eur == null) continue

    if (ref != null) {
      const ratio = eur / ref
      if (ratio < PLAUSIBEL_MIN || ratio > PLAUSIBEL_MAX) continue
    }

    let score = coverage
    const w = boersenWaehrung(sym, k?.symbolWaehrung?.[sym])
    if (w === 'EUR') score += 1000
    else if (w === 'USD' && !sym.includes('.')) score += 100
    if (sym.endsWith('.DE') || sym.endsWith('.F')) score += 50

    hits.push({ sym, coverage, score })
  }

  if (hits.length === 0) {
    let best: { sym: string; len: number } | null = null
    for (const sym of kandidaten) {
      const len = historie.get(sym)?.size ?? 0
      if (len > (best?.len ?? 0)) best = { sym, len }
    }
    return best?.sym ?? null
  }

  hits.sort((a, b) => b.score - a.score || b.coverage - a.coverage)
  return hits[0].sym
}

function waehleKursEurFuerTag(
  kandidatenEur: number[],
  einstand: number,
): number | null {
  if (kandidatenEur.length === 0) {
    return einstand > MIN_KURS_EUR ? einstand : null
  }
  if (einstand <= MIN_KURS_EUR) {
    return kandidatenEur[0]
  }

  const inBand = kandidatenEur.filter((c) => {
    const r = c / einstand
    return r >= PLAUSIBEL_MIN && r <= PLAUSIBEL_MAX
  })
  if (inBand.length === 0) {
    return einstand
  }
  const pool = inBand
  let best = pool[0]
  let bestDiff = Math.abs(best - einstand)
  for (let j = 1; j < pool.length; j++) {
    const d = Math.abs(pool[j] - einstand)
    if (d < bestDiff) {
      bestDiff = d
      best = pool[j]
    }
  }
  return best
}

/**
 * EUR-Schlusskurs je Tag für eine ISIN: beste Symbolwahl, Einstand-Fallback, LOCF.
 */
function baueEurKursSerieProIsin(
  isin: string,
  symbole: string[],
  historie: Map<string, Map<string, number>>,
  tage: string[],
  fxTage: FxKurse[],
  einstandJeTag: number[],
): number[] {
  const n = tage.length
  const nativeJeSym = new Map<string, number[]>()

  for (const sym of symbole) {
    const serie = historie.get(sym)
    if (serie?.size) nativeJeSym.set(sym, forwardFillKurse(serie, tage))
  }

  const roh: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const fx = fxTage[i]
    const einstand = einstandJeTag[i]
    const kandidatenEur: number[] = []

    for (const sym of symbole) {
      const fills = nativeJeSym.get(sym)
      const native = fills?.[i]
      if (native == null || !Number.isFinite(native) || native <= 0) continue
      const eur = kursEurAusNative(native, sym, isin, fx)
      if (eur != null && eur > MIN_KURS_EUR) kandidatenEur.push(eur)
    }

    const kursEur = waehleKursEurFuerTag(kandidatenEur, einstand)
    roh[i] = kursEur != null && kursEur > MIN_KURS_EUR ? kursEur : NaN
  }

  return loecfWerte(roh)
}

function einstandSerieProIsin(
  isin: string,
  tage: string[],
  standProTag: Map<string, DepotStand>,
): number[] {
  return tage.map((tag) => {
    const h = standProTag.get(tag)?.byIsin.get(isin)
    return h && h.einstandKurs > 0 ? h.einstandKurs : 0
  })
}

function hatOffenePositionen(stand: DepotStand): boolean {
  for (const h of stand.byIsin.values()) {
    if (h.stueck > 1e-8) return true
  }
  return false
}

function portfoliowertAmTag(
  stand: DepotStand,
  datumIso: string,
  bis: string,
  kursEurJeIsin: Map<string, number[]>,
  tagIndex: number,
  liveByIsin: Map<string, LivePosition>,
): number {
  let wert = stand.cash

  for (const [isin, h] of stand.byIsin) {
    if (h.stueck <= 1e-8) continue

    let kursEur: number | null = null
    const serie = kursEurJeIsin.get(isin)

    if (datumIso === bis) {
      const live = liveByIsin.get(isin)
      if (live?.kursLiveEur != null && live.kursLiveEur > MIN_KURS_EUR) {
        kursEur = live.kursLiveEur
      }
    }

    if (kursEur == null && serie) {
      const k = serie[tagIndex]
      if (Number.isFinite(k) && k > MIN_KURS_EUR) kursEur = k
    }

    if (kursEur == null && h.einstandKurs > MIN_KURS_EUR) {
      kursEur = h.einstandKurs
    }

    if (kursEur != null && kursEur > MIN_KURS_EUR) {
      wert += h.stueck * kursEur
    }
  }

  const einstandBasis = einstandWertpapiereEur(stand) + Math.max(0, stand.cash)
  if (hatOffenePositionen(stand) && wert < 1 && einstandBasis >= 1) {
    return einstandBasis
  }

  return wert
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
 * Lückenlose Timeline, Bestand je Tag, Kurse mit LOCF — kein Null-Klippen.
 */
export function baueWertentwicklungMitKursen(
  buchungen: PortfolioBuchung[],
  depotwertHeute: number,
  positionen: LivePosition[],
  historie: Map<string, Map<string, number>>,
  fxHeute: FxKurse,
  meta: Map<string, IsinMetadata> = new Map(),
): WertentwicklungPunkt[] {
  if (buchungen.length === 0) return []

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

  const kursEurJeIsin = new Map<string, number[]>()
  const isins = alleIsinsAusBuchungen(buchungen)

  for (const isin of isins) {
    const live = liveByIsin.get(isin)
    const pos = posByIsin.get(isin)
    const ref =
      live && live.stueck > 0
        ? live.einstandEur / live.stueck
        : (pos?.kursEur ?? 0)

    const hauptSym = symbolMitBesteAbdeckung(isin, live, pos, meta, historie, tage, ref, fxHeute)
    const kandidaten = kandidatenFuerIsin(isin, live ?? pos, meta).filter((s) => !s.startsWith('STOOQ:'))
    const symbole = [
      ...new Set([hauptSym, ...kandidaten].filter((s): s is string => Boolean(s))),
    ]

    const einstandJeTag = einstandSerieProIsin(isin, tage, standProTag)
    kursEurJeIsin.set(
      isin,
      symbole.length > 0
        ? baueEurKursSerieProIsin(isin, symbole, historie, tage, fxTage, einstandJeTag)
        : loecfWerte(einstandJeTag.map((e) => (e > 0 ? e : NaN))),
    )
  }

  const labelIdx = achsenLabelIndizes(tage)
  const punkte: WertentwicklungPunkt[] = []

  let lastPortfoliowert = 0
  for (let i = 0; i < n; i++) {
    const datumIso = tage[i]
    const stand = standProTag.get(datumIso)!
    let portfoliowertEur = portfoliowertAmTag(stand, datumIso, bis, kursEurJeIsin, i, liveByIsin)
    const zugefuehrtEur = kapital[i]

    if (zugefuehrtEur > 1 && portfoliowertEur < 1 && lastPortfoliowert > 1) {
      portfoliowertEur = lastPortfoliowert
    }
    if (portfoliowertEur >= 1) {
      lastPortfoliowert = portfoliowertEur
    }

    portfoliowertEur = round2(portfoliowertEur)

    punkte.push({
      monat: datumIso.slice(0, 7),
      datumIso,
      label: labelIdx.has(i) ? tagLabel(datumIso) : '',
      portfoliowertEur,
      zugefuehrtEur,
      differenzEur: round2(portfoliowertEur - zugefuehrtEur),
    })
  }

  if (n > 0 && depotwertHeute > 0) {
    const last = punkte[n - 1]
    if (last.portfoliowertEur < depotwertHeute * 0.5) {
      last.portfoliowertEur = round2(depotwertHeute)
      last.differenzEur = round2(last.portfoliowertEur - last.zugefuehrtEur)
    }
  }

  return punkte
}
