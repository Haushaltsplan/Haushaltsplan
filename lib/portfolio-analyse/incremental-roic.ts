/**
 * Incremental ROIC (ROIIC) — GuruFocus-Standard: ΔNOPAT / ΔInvested Capital.
 *
 * Primär 5-Jahres-, dann 3-/2-Jahres-Fenster (wie GuruFocus ROIIC 5Y/3Y).
 * CapEx-only-Heuristik erzeugt bei asset-light Titeln 400 %+ → nur Fallback.
 */

import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { effektiverSteuersatz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'

export type IncrementalRoicQuelle =
  | 'gurufocus'
  | 'yahoo'
  | 'nasdaq'
  | 'stockanalysis'
  /** Kanonische Kapitalbasis (SEC XBRL + Yahoo + StockAnalysis + Macrotrends, feldweise gemergt). */
  | 'kapitalbasis'
  | 'organic'
  | 'tangible'
  | null

export type IncrementalRoicPaket = {
  incrementalRoicPct: number | null
  incrementalRoic1yPct: number | null
  incrementalRoic5yPct: number | null
  fensterJahre: number | null
  quelle: IncrementalRoicQuelle
  methode: 'organic_capex' | 'tangible_ic' | 'book_ic' | null
  /**
   * Zusatzangaben aus der Kapitalbasis-Berechnung. Optional, weil die Altquellen
   * (GuruFocus, Nasdaq, Yahoo) sie nicht liefern können.
   */
  regime?: 'normal' | 'kapitalleicht' | 'schrumpfend' | 'unzureichend' | null
  /** ROIIC inkl. akquiriertem Kapital — der Kontrast zum organischen Wert ist die Aussage. */
  buchPct?: number | null
  /** Wert vor Deckelung, für Ranking und Transparenz. */
  rohPct?: number | null
  /** Fenster überspannt eine Großakquisition — Wert nach oben verzerrt. */
  maImFenster?: boolean
  begruendung?: string | null
}

export type JahrSnap = {
  jahr: number
  nopatMio: number
  icMio: number
}

export type JahrSnapErweitert = JahrSnap & {
  capexMio?: number | null
  daMio?: number | null
  goodwillMio?: number | null
  intangiblesMio?: number | null
}

export function nopatMioAusOperating(
  operatingIncomeUsd: number | null,
  pretaxUsd: number | null,
  taxUsd: number | null,
): number | null {
  if (operatingIncomeUsd == null || !Number.isFinite(operatingIncomeUsd)) return null
  const t = effektiverSteuersatz(pretaxUsd, taxUsd)
  return (operatingIncomeUsd * (1 - t)) / 1_000_000
}

export function icMioAusBilanz(
  equityUsd: number | null,
  debtUsd: number | null,
  cashUsd: number | null,
): number | null {
  if (equityUsd == null || !Number.isFinite(equityUsd)) return null
  return (equityUsd + (debtUsd ?? 0) - (cashUsd ?? 0)) / 1_000_000
}

function clampPct(pct: number | null, maxAbs = 150): number | null {
  if (pct == null || !Number.isFinite(pct)) return null
  if (Math.abs(pct) > maxAbs) return null
  return Math.round(pct * 10) / 10
}

/** GuruFocus-Book: negative ROIIC zulassen, nur extreme Positive filtern. */
function clampBookPct(pct: number | null): number | null {
  if (pct == null || !Number.isFinite(pct)) return null
  if (pct > 120) return null
  if (pct < -250) return null
  return Math.round(pct * 10) / 10
}

function tangibleIcMio(s: JahrSnapErweitert): number | null {
  const gw = s.goodwillMio ?? 0
  const inta = s.intangiblesMio ?? 0
  const v = s.icMio - gw - inta
  return Number.isFinite(v) ? v : null
}

function goodwillSprungDominiert(
  aktuell: JahrSnapErweitert,
  basis: JahrSnapErweitert,
): boolean {
  const dIc = aktuell.icMio - basis.icMio
  const dGw = (aktuell.goodwillMio ?? 0) - (basis.goodwillMio ?? 0)
  // Transformational: Goodwill ≥ 5 Mrd. in einem Schritt (z. B. SPGI/IHS)
  if (dGw >= 5_000) return true
  if (dGw < 500) return false
  // Bolt-ons (TMO): nur blockieren wenn GW-Sprung >50 % des IC-Zuwachses
  if (dIc <= 0) return dGw >= 1_500
  return dGw / dIc > 0.5 && dGw >= 1_000
}

function findeMegaMaJahre(sorted: JahrSnapErweitert[]): number[] {
  const out: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const dGw = (sorted[i]!.goodwillMio ?? 0) - (sorted[i - 1]!.goodwillMio ?? 0)
    if (dGw >= 2_000) out.push(sorted[i]!.jahr)
  }
  return out
}

/** Erstes Mega-M&A (nicht letztes Bolt-on-Jahr — sonst blockiert es alle Fenster). */
function findeMegaMaJahr(sorted: JahrSnapErweitert[]): number | null {
  return findeMegaMaJahre(sorted)[0] ?? null
}

/** Erstes Post-Deal-Basisjahr (= Deal-Jahr; NOPAT/IC ab Integration). */
function fruehestesBasisJahr(sorted: JahrSnapErweitert[]): number {
  const maJahr = findeMegaMaJahr(sorted)
  if (maJahr == null) return sorted[0]!.jahr
  const last = sorted[sorted.length - 1]!
  const basis = maJahr
  if (basis > last.jahr - 1) return Math.max(last.jahr - 1, sorted[0]!.jahr)
  return basis
}

function fensterEnthaeltMegaMa(
  basis: JahrSnapErweitert,
  last: JahrSnapErweitert,
  sorted: JahrSnapErweitert[],
): boolean {
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!
    if (cur.jahr <= basis.jahr || prev.jahr > last.jahr) continue
    if (goodwillSprungDominiert(cur, prev)) return true
  }
  return goodwillSprungDominiert(last, basis)
}

/** Asset-light: IC stagniert/schrumpft post-Deal — CapEx ist der sinnvolle Nenner. */
function icStagniertPostDeal(aktuell: JahrSnapErweitert, basis: JahrSnapErweitert): boolean {
  const dIcBook = aktuell.icMio - basis.icMio
  const a = tangibleIcMio(aktuell)
  const b = tangibleIcMio(basis)
  const dIcTang = a != null && b != null ? a - b : dIcBook
  const avgIc = (Math.abs(aktuell.icMio) + Math.abs(basis.icMio)) / 2
  const schwelle = Math.max(50, avgIc * 0.02)
  return Math.abs(dIcTang) < schwelle || (dIcTang <= 0 && aktuell.nopatMio > basis.nopatMio)
}

/** Book-ROIIC: nur bei echtem Kapitalaufbau ohne M&A-Goodwill-Dominanz. */
export function roiicBookPct(aktuell: JahrSnapErweitert, basis: JahrSnapErweitert): number | null {
  if (goodwillSprungDominiert(aktuell, basis)) return null
  if (icStagniertPostDeal(aktuell, basis)) return null
  const dNopat = aktuell.nopatMio - basis.nopatMio
  const dIc = aktuell.icMio - basis.icMio
  const minIcDelta = Math.max(5, Math.abs(aktuell.icMio) * 0.01)
  if (Math.abs(dIc) < minIcDelta || dNopat <= 0) return null
  return clampPct((dNopat / dIc) * 100)
}

/** Tangible ROIIC: Δ(IC − GW − Intangibles) — Standard post-M&A. */
export function roiicTangiblePct(aktuell: JahrSnapErweitert, basis: JahrSnapErweitert): number | null {
  const a = tangibleIcMio(aktuell)
  const b = tangibleIcMio(basis)
  if (a == null || b == null) return null
  const dNopat = aktuell.nopatMio - basis.nopatMio
  if (dNopat <= 0) return null
  const dIc = a - b
  const minIcDelta = Math.max(20, Math.abs(a) * 0.005)
  if (Math.abs(dIc) < minIcDelta) return null
  return clampPct((dNopat / dIc) * 100)
}

/**
 * Organischer ROIIC = ΔNOPAT / Σ CapEx im Fenster.
 * Bei amortisationslastigen Titeln (D&A ≫ CapEx) CapEx-D&A nicht abziehen —
 * sonst wird der Nenner 0 (IFRS-Amortisation ≠ Cash-Reinvestition).
 */
export function roiicOrganicPct(
  aktuell: JahrSnapErweitert,
  basis: JahrSnapErweitert,
  dazwischen: JahrSnapErweitert[],
): number | null {
  const dNopat = aktuell.nopatMio - basis.nopatMio
  if (dNopat <= 0) return null
  const jahre = [...dazwischen.filter((s) => s.jahr > basis.jahr && s.jahr <= aktuell.jahr)]
  if (!jahre.some((s) => s.jahr === aktuell.jahr)) jahre.push(aktuell)

  let sumCapex = 0
  let sumDa = 0
  let hatCapex = false
  for (const s of jahre) {
    if (s.capexMio == null || !Number.isFinite(s.capexMio)) continue
    hatCapex = true
    sumCapex += Math.abs(s.capexMio)
    sumDa += s.daMio != null ? Math.abs(s.daMio) : 0
  }
  if (!hatCapex || sumCapex < 1) return null

  const denom =
    sumDa > 2.5 * sumCapex ? sumCapex : Math.max(sumCapex - sumDa, sumCapex * 0.25)

  if (denom < 1) return null
  // Asset-light: wenig CapEx vs. Gewinnwachstum → Nenner zu klein, Werte >100 % sind irreführend
  if (sumCapex < dNopat * 0.2) return null
  const pct = (dNopat / denom) * 100
  if (pct > 100) return null
  return clampPct(pct)
}

type Kandidat = {
  pct: number
  fensterJahre: number
  methode: NonNullable<IncrementalRoicPaket['methode']>
}

function kandidatenFuerFenster(
  snaps: JahrSnapErweitert[],
  last: JahrSnapErweitert,
  basis: JahrSnapErweitert,
  postDealModus: boolean,
): Kandidat[] {
  const span = last.jahr - basis.jahr
  if (span < 1) return []
  const dazwischen = snaps.filter((s) => s.jahr >= basis.jahr && s.jahr <= last.jahr)
  const out: Kandidat[] = []

  const tang = roiicTangiblePct(last, basis)
  if (tang != null) out.push({ pct: tang, fensterJahre: span, methode: 'tangible_ic' })

  if (!fensterEnthaeltMegaMa(basis, last, snaps)) {
    const book = roiicBookPct(last, basis)
    if (book != null) out.push({ pct: book, fensterJahre: span, methode: 'book_ic' })
  }

  const org = roiicOrganicPct(last, basis, dazwischen)
  if (org != null) out.push({ pct: org, fensterJahre: span, methode: 'organic_capex' })

  void postDealModus
  return out
}

/** Nur Tangible-Fallback wenn Book-ΔIC zu klein (asset-light, kein M&A-Sprung). */
function kandidatenTangibleOnly(
  snaps: JahrSnapErweitert[],
  last: JahrSnapErweitert,
  basis: JahrSnapErweitert,
): Kandidat[] {
  const span = last.jahr - basis.jahr
  if (span < 2) return []
  const tang = roiicTangiblePct(last, basis)
  if (tang == null) return []
  return [{ pct: tang, fensterJahre: span, methode: 'tangible_ic' }]
}

/** Tangible > Book > Organic; 2–3J post-M&A; Extremwerte >100 % abwerten. */
function waehleBesten(kandidaten: Kandidat[], postDealModus: boolean): Kandidat | null {
  if (kandidaten.length === 0) return null
  const prio = (m: Kandidat['methode']) =>
    m === 'tangible_ic' ? 0 : m === 'book_ic' ? 1 : 2

  const scored = kandidaten.map((k) => {
    const fensterScore = postDealModus
      ? k.fensterJahre >= 2 && k.fensterJahre <= 3
        ? 0
        : k.fensterJahre === 1
          ? 2
          : 1
      : k.fensterJahre >= 3 && k.fensterJahre <= 5
        ? 0
        : k.fensterJahre === 2
          ? 1
          : k.fensterJahre === 1
            ? 3
            : 2
    const extrem =
      Math.abs(k.pct) > 100 ? 4 : Math.abs(k.pct) > 80 ? 2 : Math.abs(k.pct) > 60 ? 1 : 0
    return { k, score: prio(k.methode) * 10 + fensterScore + extrem }
  })
  scored.sort((a, b) => a.score - b.score || Math.abs(a.k.pct) - Math.abs(b.k.pct))
  return scored[0]!.k
}

export function paketAusSnaps(
  snaps: JahrSnapErweitert[],
  quelle: 'yahoo' | 'nasdaq' | 'stockanalysis',
): IncrementalRoicPaket {
  if (snaps.length < 2) {
    return {
      incrementalRoicPct: null,
      incrementalRoic1yPct: null,
      incrementalRoic5yPct: null,
      fensterJahre: null,
      quelle: null,
      methode: null,
    }
  }

  const sorted = [...snaps].sort((a, b) => a.jahr - b.jahr)
  const last = sorted[sorted.length - 1]!
  const earliestBasis = fruehestesBasisJahr(sorted)
  const postDealModus = findeMegaMaJahr(sorted) != null

  const alle: Kandidat[] = []
  for (const span of [1, 2, 3, 4, 5, 6, 7]) {
    const basis = sorted.find((s) => s.jahr === last.jahr - span)
    if (!basis || basis.jahr < earliestBasis) continue
    alle.push(...kandidatenFuerFenster(sorted, last, basis, postDealModus))
  }

  const y1Basis = sorted[sorted.length - 2]!
  const y1Kand =
    y1Basis.jahr >= earliestBasis
      ? kandidatenFuerFenster(sorted, last, y1Basis, postDealModus)
      : []
  const y1Best = waehleBesten(y1Kand, postDealModus)

  const multi = alle.filter((k) => k.fensterJahre >= 2)
  const bestMulti = waehleBesten(multi, postDealModus)
  const best = bestMulti ?? waehleBesten(alle, postDealModus)

  const incrementalRoicPct =
    best != null
      ? best.pct
      : y1Best != null && Math.abs(y1Best.pct) <= 100
        ? y1Best.pct
        : null

  const methode = best?.methode ?? (incrementalRoicPct != null ? y1Best?.methode ?? null : null)
  const fensterJahre = best?.fensterJahre ?? (incrementalRoicPct != null ? 1 : null)

  const quelleOut: IncrementalRoicQuelle =
    incrementalRoicPct == null
      ? null
      : methode === 'organic_capex'
        ? 'organic'
        : methode === 'tangible_ic'
          ? 'tangible'
          : quelle

  return {
    incrementalRoicPct,
    incrementalRoic1yPct: y1Best?.pct ?? null,
    incrementalRoic5yPct: bestMulti?.fensterJahre != null && bestMulti.fensterJahre >= 3 ? bestMulti.pct : null,
    fensterJahre,
    quelle: quelleOut,
    methode,
  }
}

export function snapsAusYahoo(hist: YahooJahresSnapshot[]): JahrSnapErweitert[] {
  const out: JahrSnapErweitert[] = []
  for (const s of hist) {
    const jahr = parseInt(s.datum.slice(0, 4), 10)
    if (!Number.isFinite(jahr)) continue
    const nopat = nopatMioAusOperating(s.operatingIncomeUsd, s.pretaxIncomeUsd, s.taxProvisionUsd)
    const ic = icMioAusBilanz(s.stockholdersEquityUsd, s.totalDebtUsd, s.cashAndEquivalentsUsd)
    if (nopat == null || ic == null) continue
    out.push({
      jahr,
      nopatMio: nopat,
      icMio: ic,
      capexMio:
        s.capitalExpenditureUsd != null ? Math.abs(s.capitalExpenditureUsd) / 1_000_000 : null,
      daMio:
        s.depreciationAmortizationUsd != null
          ? Math.abs(s.depreciationAmortizationUsd) / 1_000_000
          : null,
      goodwillMio: s.goodwillUsd != null ? s.goodwillUsd / 1_000_000 : null,
      intangiblesMio: null,
    })
  }
  return out.sort((a, b) => a.jahr - b.jahr)
}

export function berechneIncrementalRoicAusYahoo(
  hist: YahooJahresSnapshot[] | null | undefined,
): IncrementalRoicPaket {
  if (!hist?.length) {
    return leeresIncrementalRoicPaket()
  }
  return berechneRoiicAusSnaps(snapsAusYahoo(hist), 'yahoo')
}

/**
 * ROIIC aus gescrapten Snaps — GuruFocus-Standard (ΔNOPAT/ΔIC, 5J) zuerst.
 */
export function berechneRoiicAusSnaps(
  snaps: JahrSnapErweitert[],
  quelle: 'yahoo' | 'nasdaq' | 'stockanalysis',
): IncrementalRoicPaket {
  if (snaps.length < 2) return leeresIncrementalRoicPaket()

  const book = berechneGuruFocusRoiicAusSnaps(snaps, quelle)
  if (book.incrementalRoicPct != null) return book

  return paketAusSnapsTangibleFallback(snaps, quelle)
}

function paketAusSnapsTangibleFallback(
  snaps: JahrSnapErweitert[],
  quelle: 'yahoo' | 'nasdaq' | 'stockanalysis',
): IncrementalRoicPaket {
  const sorted = [...snaps].sort((a, b) => a.jahr - b.jahr)
  const last = sorted[sorted.length - 1]!
  const earliestBasis = fruehestesBasisJahr(sorted)

  const alle: Kandidat[] = []
  for (const span of [2, 3, 4, 5]) {
    const basis = sorted.find((s) => s.jahr === last.jahr - span)
    if (!basis || basis.jahr < earliestBasis) continue
    alle.push(...kandidatenTangibleOnly(sorted, last, basis))
  }

  const best = waehleBesten(alle, false)
  if (best == null) return leeresIncrementalRoicPaket()

  return {
    incrementalRoicPct: best.pct,
    incrementalRoic1yPct: null,
    incrementalRoic5yPct: best.fensterJahre >= 3 ? best.pct : null,
    fensterJahre: best.fensterJahre,
    quelle: 'tangible',
    methode: 'tangible_ic',
  }
}

function leeresIncrementalRoicPaket(): IncrementalRoicPaket {
  return {
    incrementalRoicPct: null,
    incrementalRoic1yPct: null,
    incrementalRoic5yPct: null,
    fensterJahre: null,
    quelle: null,
    methode: null,
  }
}

/**
 * GuruFocus-Standard: ROIIC = ΔNOPAT / ΔInvested Capital × 100.
 * Inputs kommen aus gescrapten Statements (StockAnalysis/Nasdaq/Yahoo), nicht aus heuristischen Varianten.
 * @see https://www.gurufocus.com/term/roiic-5y
 */
export function berechneGuruFocusRoiicAusSnaps(
  snaps: JahrSnapErweitert[],
  quelle: Exclude<IncrementalRoicQuelle, 'gurufocus' | 'organic' | 'tangible' | null>,
): IncrementalRoicPaket {
  if (snaps.length < 2) return leeresIncrementalRoicPaket()

  const sorted = [...snaps].sort((a, b) => a.jahr - b.jahr)
  const last = sorted[sorted.length - 1]!

  const roiicFuerSpan = (span: number): number | null => {
    const basis = sorted.find((s) => s.jahr === last.jahr - span)
    if (!basis) return null
    const dNopat = last.nopatMio - basis.nopatMio
    const dIc = last.icMio - basis.icMio
    const minIcDelta = Math.max(5, Math.abs(last.icMio) * 0.01)
    if (Math.abs(dIc) < minIcDelta) return null
    return clampBookPct((dNopat / dIc) * 100)
  }

  const incrementalRoic1yPct = roiicFuerSpan(1)
  const y2 = roiicFuerSpan(2)
  const y3 = roiicFuerSpan(3)
  const incrementalRoic5yPct = roiicFuerSpan(5)

  let incrementalRoicPct: number | null = null
  let fensterJahre: number | null = null
  if (incrementalRoic5yPct != null) {
    incrementalRoicPct = incrementalRoic5yPct
    fensterJahre = 5
  } else if (y3 != null) {
    incrementalRoicPct = y3
    fensterJahre = 3
  } else if (y2 != null) {
    incrementalRoicPct = y2
    fensterJahre = 2
  } else if (incrementalRoic1yPct != null) {
    incrementalRoicPct = incrementalRoic1yPct
    fensterJahre = 1
  }

  if (incrementalRoicPct == null) return leeresIncrementalRoicPaket()

  return {
    incrementalRoicPct,
    incrementalRoic1yPct,
    incrementalRoic5yPct,
    fensterJahre,
    quelle,
    methode: 'book_ic',
  }
}
