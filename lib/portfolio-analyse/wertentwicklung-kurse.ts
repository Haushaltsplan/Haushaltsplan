/**
 * Wertentwicklung: tägliche Timeline, Bestand × LOCF-Kurs (Yahoo + Stooq).
 * Portfoliowert darf bei offenen Positionen nicht auf 0 kollabieren.
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
import {
  stooqHistorieKey,
  yahooZuStooqSymbol,
} from '@/lib/portfolio-analyse/stooq-historie-server'
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

const PLAUSIBEL_MIN = 0.12
const PLAUSIBEL_MAX = 8
const MIN_KURS_EUR = 1e-8
const MIN_KURS_ZU_EINSTAND = 0.12
const MAX_KURS_ZU_EINSTAND = 8
/** Portfoliowert < 25 % Einstand bei offenen Positionen → Datenfehler. */
const MIN_PORTFOLIO_ZU_EINSTAND = 0.25

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function stooqPseudoYahoo(stooqSym: string): string {
  const s = stooqSym.trim().toLowerCase()
  if (s.endsWith('.de')) return 'DUMMY.DE'
  if (s.endsWith('.uk')) return 'DUMMY.L'
  if (s.endsWith('.us')) return 'DUMMY'
  if (s.endsWith('.ch')) return 'DUMMY.SW'
  if (s.endsWith('.ca')) return 'DUMMY.TO'
  if (s.endsWith('.pa')) return 'DUMMY.PA'
  if (s.endsWith('.as')) return 'DUMMY.AS'
  return 'DUMMY.DE'
}

function kursEurAusNative(
  native: number,
  sym: string,
  isin: string,
  fx: FxKurse,
): number | null {
  if (!Number.isFinite(native) || native <= 0) return null
  const kenntnis = isinKenntnis(isin)
  if (sym.toUpperCase().startsWith('STOOQ:')) {
    const pseudo = stooqPseudoYahoo(sym.slice(6))
    return preisInEur(native, pseudo, fx, kenntnis?.symbolWaehrung?.[sym])
  }
  if (kenntnis?.kursNurSymbol && sym.toUpperCase() === kenntnis.kursNurSymbol.toUpperCase()) {
    return native
  }
  return preisInEur(native, sym, fx, kenntnis?.symbolWaehrung?.[sym])
}

function stooqSymboleFuerIsin(
  isin: string,
  live: LivePosition | undefined,
  pos: PortfolioPositionSnapshot | undefined,
  meta: Map<string, IsinMetadata>,
): string[] {
  const k = isinKenntnis(isin)
  const aus: string[] = []
  if (k?.stooqSymbol) aus.push(k.stooqSymbol.trim().toLowerCase())
  const yahoo =
    live?.symbolYahoo ??
    meta.get(isin)?.symbolYahoo ??
    k?.symbolYahoo ??
    k?.kursNurSymbol
  if (yahoo) {
    const st = yahooZuStooqSymbol(yahoo)
    if (st) aus.push(st)
  }
  for (const c of k?.symbolCandidates ?? meta.get(isin)?.symbolCandidates ?? []) {
    const st = yahooZuStooqSymbol(c)
    if (st) aus.push(st)
  }
  return [...new Set(aus.filter(Boolean))]
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

function alleIsinsAusBuchungen(buchungen: PortfolioBuchung[]): Set<string> {
  const isins = new Set<string>()
  for (const b of buchungen) {
    if (!b.isin) continue
    if (b.typ === 'kauf' || b.typ === 'verkauf') isins.add(b.isin.toUpperCase())
  }
  return isins
}

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

function abdeckungTage(nativeFilled: number[]): number {
  return nativeFilled.filter((v) => Number.isFinite(v) && v > 0).length
}

function letzterNativeKurs(serie: Map<string, number>): number | null {
  const keys = [...serie.keys()].sort()
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = serie.get(keys[i])
    if (v != null && v > 0) return v
  }
  return null
}

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
    const coverage = abdeckungTage(forwardFillKurse(serie, tage))
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

function kursPlausibel(kurs: number, einstand: number): boolean {
  if (einstand <= MIN_KURS_EUR) return true
  const r = kurs / einstand
  /** Nur zu niedrige Kurse verwerfen (falsches Symbol) — starke Gewinner nicht kappen. */
  return r >= MIN_KURS_ZU_EINSTAND
}

function waehleTageskursEur(kandidaten: number[], einstand: number, lastGood: number): number {
  const gueltig = kandidaten.filter((c) => c > MIN_KURS_EUR && kursPlausibel(c, einstand))
  if (gueltig.length > 0) {
    if (einstand <= MIN_KURS_EUR) return gueltig[0]
    let best = gueltig[0]
    let diff = Math.abs(best - einstand)
    for (let i = 1; i < gueltig.length; i++) {
      const d = Math.abs(gueltig[i] - einstand)
      if (d < diff) {
        diff = d
        best = gueltig[i]
      }
    }
    return best
  }
  const roh = kandidaten.filter((c) => c > MIN_KURS_EUR)
  if (roh.length > 0) return roh[0]
  if (lastGood > MIN_KURS_EUR && kursPlausibel(lastGood, einstand)) return lastGood
  if (einstand > MIN_KURS_EUR) return einstand
  return lastGood > MIN_KURS_EUR ? lastGood : 0
}

type IsinKursLauf = {
  symbole: string[]
  filledJeSym: Map<string, number[]>
  lastGoodEur: number
}

function symboleFuerIsinHistorie(
  isin: string,
  live: LivePosition | undefined,
  pos: PortfolioPositionSnapshot | undefined,
  meta: Map<string, IsinMetadata>,
  historie: Map<string, Map<string, number>>,
  tage: string[],
  ref: number,
  fxHeute: FxKurse,
): string[] {
  const hauptSym = symbolMitBesteAbdeckung(isin, live, pos, meta, historie, tage, ref, fxHeute)
  const yahoo = kandidatenFuerIsin(isin, live ?? pos, meta).filter((s) => !s.startsWith('STOOQ:'))
  const stooq = stooqSymboleFuerIsin(isin, live, pos, meta).map((s) => stooqHistorieKey(s))
  const merged = [...new Set([hauptSym, ...yahoo, ...stooq].filter((s): s is string => Boolean(s)))]
  const mitDaten = merged.filter((s) => (historie.get(s)?.size ?? 0) > 0)
  return mitDaten.length > 0 ? mitDaten : merged
}

function baueIsinKursLaeufe(
  isins: Set<string>,
  liveByIsin: Map<string, LivePosition>,
  posByIsin: Map<string, PortfolioPositionSnapshot>,
  meta: Map<string, IsinMetadata>,
  historie: Map<string, Map<string, number>>,
  tage: string[],
  fxHeute: FxKurse,
): Map<string, IsinKursLauf> {
  const out = new Map<string, IsinKursLauf>()
  for (const isin of isins) {
    const live = liveByIsin.get(isin)
    const pos = posByIsin.get(isin)
    const ref =
      live && live.stueck > 0 ? live.einstandEur / live.stueck : (pos?.kursEur ?? 0)
    const symbole = symboleFuerIsinHistorie(isin, live, pos, meta, historie, tage, ref, fxHeute)
    const filledJeSym = new Map<string, number[]>()
    for (const sym of symbole) {
      const serie = historie.get(sym)
      if (serie?.size) filledJeSym.set(sym, forwardFillKurse(serie, tage))
    }
    out.set(isin, { symbole, filledJeSym, lastGoodEur: ref > MIN_KURS_EUR ? ref : 0 })
  }
  return out
}

function kursEurAnTag(
  isin: string,
  lauf: IsinKursLauf,
  tagIndex: number,
  fx: FxKurse,
  einstand: number,
  liveKurs: number | null,
): number {
  if (liveKurs != null && liveKurs > MIN_KURS_EUR && kursPlausibel(liveKurs, einstand)) {
    lauf.lastGoodEur = liveKurs
    return liveKurs
  }

  const kandidaten: number[] = []
  for (const sym of lauf.symbole) {
    const native = lauf.filledJeSym.get(sym)?.[tagIndex]
    if (native == null || !Number.isFinite(native) || native <= 0) continue
    const eur = kursEurAusNative(native, sym, isin, fx)
    if (eur != null && eur > MIN_KURS_EUR) kandidaten.push(eur)
  }

  const k = waehleTageskursEur(kandidaten, einstand, lauf.lastGoodEur)
  if (k > MIN_KURS_EUR && kursPlausibel(k, einstand)) {
    lauf.lastGoodEur = k
  }
  return k > MIN_KURS_EUR ? k : einstand > MIN_KURS_EUR ? einstand : lauf.lastGoodEur
}

function hatOffenePositionen(stand: DepotStand): boolean {
  for (const h of stand.byIsin.values()) {
    if (h.stueck > 1e-8) return true
  }
  return false
}

function portfoliowertAusStand(
  stand: DepotStand,
  datumIso: string,
  bis: string,
  tagIndex: number,
  fxTage: FxKurse[],
  laeufe: Map<string, IsinKursLauf>,
  liveByIsin: Map<string, LivePosition>,
): number {
  const fx = fxTage[tagIndex]
  let wertWp = 0

  for (const [isin, h] of stand.byIsin) {
    if (h.stueck <= 1e-8) continue
    const lauf = laeufe.get(isin)
    if (!lauf) {
      wertWp += h.stueck * h.einstandKurs
      continue
    }
    let liveKurs: number | null = null
    if (datumIso === bis) {
      const live = liveByIsin.get(isin)
      if (live?.kursLiveEur != null && live.kursLiveEur > MIN_KURS_EUR) {
        liveKurs = live.kursLiveEur
      }
    }
    const kurs = kursEurAnTag(isin, lauf, tagIndex, fx, h.einstandKurs, liveKurs)
    wertWp += h.stueck * (kurs > MIN_KURS_EUR ? kurs : h.einstandKurs)
  }

  return wertWp + stand.cash
}

export function yahooSymboleFuerHistorie(
  buchungen: PortfolioBuchung[],
  livePositionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): string[] {
  const alle = positionenFuerKurshistorie(buchungen, livePositionen)
  const wp = symboleAusMeta(alle, meta).filter((s) => !s.startsWith('STOOQ:'))
  return [...new Set([...wp, ...FX_SYMBOLE])]
}

export function stooqSymboleFuerHistorie(
  buchungen: PortfolioBuchung[],
  livePositionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): string[] {
  const liveByIsin = new Map(
    livePositionen.filter((p) => p.isin).map((p) => [p.isin!.toUpperCase(), p] as const),
  )
  const alle = positionenFuerKurshistorie(buchungen, livePositionen)
  const posByIsin = new Map(alle.filter((p) => p.isin).map((p) => [p.isin!.toUpperCase(), p]))
  const syms = new Set<string>()
  for (const isin of alleIsinsAusBuchungen(buchungen)) {
    for (const s of stooqSymboleFuerIsin(isin, liveByIsin.get(isin), posByIsin.get(isin), meta)) {
      syms.add(s)
    }
  }
  return [...syms]
}

/**
 * Tägliche Wertentwicklung — eine chronologische Pipeline (Bestand → Kurs-LOCF → Portfoliowert).
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
  const isins = alleIsinsAusBuchungen(buchungen)
  const liveByIsin = new Map(
    positionen.filter((p) => p.isin).map((p) => [p.isin!.toUpperCase(), p] as const),
  )
  const posByIsin = new Map(
    positionenFuerKurshistorie(buchungen, positionen)
      .filter((p) => p.isin)
      .map((p) => [p.isin!.toUpperCase(), p]),
  )

  const fxTage = fxProTag(historie, tage)
  const laeufe = baueIsinKursLaeufe(isins, liveByIsin, posByIsin, meta, historie, tage, fxHeute)

  const labelIdx = achsenLabelIndizes(tage)
  const punkte: WertentwicklungPunkt[] = []
  let lastGoodPortfolio = 0

  for (let i = 0; i < n; i++) {
    const datumIso = tage[i]
    const stand = standProTag.get(datumIso)!
    const zugefuehrtEur = kapital[i]
    const einstandWp = einstandWertpapiereEur(stand)
    const untergrenze = einstandWp + Math.max(0, stand.cash)

    let portfoliowertEur = portfoliowertAusStand(
      stand,
      datumIso,
      bis,
      i,
      fxTage,
      laeufe,
      liveByIsin,
    )

    const offen = hatOffenePositionen(stand)
    const kollabiert =
      offen &&
      einstandWp >= 1 &&
      (!Number.isFinite(portfoliowertEur) || portfoliowertEur < untergrenze * MIN_PORTFOLIO_ZU_EINSTAND)

    if (kollabiert) {
      /** Einstand wächst mit Käufen — nicht auf altem LOCF-Wert „einfrieren“. */
      portfoliowertEur =
        lastGoodPortfolio > untergrenze * MIN_PORTFOLIO_ZU_EINSTAND
          ? Math.max(untergrenze, lastGoodPortfolio)
          : untergrenze
    }

    if (
      offen &&
      Number.isFinite(portfoliowertEur) &&
      portfoliowertEur >= untergrenze * MIN_PORTFOLIO_ZU_EINSTAND
    ) {
      lastGoodPortfolio = portfoliowertEur
    }

    punkte.push({
      monat: datumIso.slice(0, 7),
      datumIso,
      label: labelIdx.has(i) ? tagLabel(datumIso) : '',
      portfoliowertEur: round2(portfoliowertEur),
      zugefuehrtEur,
      differenzEur: round2(portfoliowertEur - zugefuehrtEur),
    })
  }

  return punkte
}
