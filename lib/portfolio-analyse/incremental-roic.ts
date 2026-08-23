/**
 * Incremental ROIC (ROIIC).
 *
 * Wichtig: Book-ΔIC nach Groß-M&A (Goodwill) ist oft sinnlos niedrig
 * (z. B. SPGI nach IHS Markit). Deshalb:
 * 1) Organisch: ΔNOPAT / Σ CapEx (bei amortisationslastigen Titeln)
 * 2) Tangible: ΔNOPAT / Δ(IC − Goodwill − Intangibles)
 * 3) Book nur ohne Goodwill-Sprung
 */

import type { YahooJahresSnapshot } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { effektiverSteuersatz } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'

export type IncrementalRoicQuelle =
  | 'yahoo'
  | 'nasdaq'
  | 'stockanalysis'
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

function clampPct(pct: number | null): number | null {
  if (pct == null || !Number.isFinite(pct)) return null
  if (Math.abs(pct) > 2_000) return null
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
  // Mega-M&A: Goodwill-Zuwachs ≥ 2 Mrd. (z. B. SPGI/IHS Markit)
  if (dGw >= 2_000) return true
  if (dGw < 500) return false
  // Mittelgroßer Sprung nur relevant, wenn er den IC-Zuwachs dominiert
  if (dIc <= 0) return dGw >= 1_500
  return dGw / dIc > 0.5 && dGw >= 1_000
}

/** Book-ROIIC: nur bei echtem Kapitalaufbau ohne M&A-Goodwill-Dominanz. */
export function roiicBookPct(aktuell: JahrSnapErweitert, basis: JahrSnapErweitert): number | null {
  if (goodwillSprungDominiert(aktuell, basis)) return null
  const dNopat = aktuell.nopatMio - basis.nopatMio
  const dIc = aktuell.icMio - basis.icMio
  if (dIc < 5) return null
  return clampPct((dNopat / dIc) * 100)
}

/** Tangible ROIIC: IC ohne Goodwill/Intangibles. */
export function roiicTangiblePct(aktuell: JahrSnapErweitert, basis: JahrSnapErweitert): number | null {
  if (goodwillSprungDominiert(aktuell, basis)) return null
  const a = tangibleIcMio(aktuell)
  const b = tangibleIcMio(basis)
  if (a == null || b == null) return null
  const dIc = a - b
  if (dIc < 5) return null
  const dNopat = aktuell.nopatMio - basis.nopatMio
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

  // Amortisationslastig → nur CapEx als Nenner (asset-light / M&A-Intangibles)
  const denom =
    sumDa > 2.5 * sumCapex ? sumCapex : Math.max(sumCapex - sumDa, sumCapex * 0.25)

  if (denom < 1) return null
  return clampPct((dNopat / denom) * 100)
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
): Kandidat[] {
  const span = last.jahr - basis.jahr
  if (span < 1) return []
  const dazwischen = snaps.filter((s) => s.jahr >= basis.jahr && s.jahr <= last.jahr)
  const out: Kandidat[] = []

  const org = roiicOrganicPct(last, basis, dazwischen)
  if (org != null) out.push({ pct: org, fensterJahre: span, methode: 'organic_capex' })

  const tang = roiicTangiblePct(last, basis)
  if (tang != null) out.push({ pct: tang, fensterJahre: span, methode: 'tangible_ic' })

  const book = roiicBookPct(last, basis)
  if (book != null) out.push({ pct: book, fensterJahre: span, methode: 'book_ic' })

  return out
}

/**
 * Auswahl: organisch vor tangible vor book; bei gleichem Typ 3–5J bevorzugen
 * (nicht blind längstes Fenster — das enthält oft Mega-M&A).
 */
function waehleBesten(kandidaten: Kandidat[]): Kandidat | null {
  if (kandidaten.length === 0) return null
  const prio = (m: Kandidat['methode']) =>
    m === 'organic_capex' ? 0 : m === 'tangible_ic' ? 1 : 2

  const scored = kandidaten.map((k) => {
    // Ideal: 3–5 Jahre; 1J und >7J abwerten
    const fensterScore =
      k.fensterJahre >= 3 && k.fensterJahre <= 5
        ? 0
        : k.fensterJahre === 2
          ? 1
          : k.fensterJahre === 1
            ? 3
            : 2
    // Extremwerte (>300 %) leicht abwerten, aber nicht gegenüber organisch verlieren
    const extrem = Math.abs(k.pct) > 300 ? 1 : 0
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

  const alle: Kandidat[] = []
  for (const span of [1, 2, 3, 4, 5, 6, 7]) {
    const basis = sorted.find((s) => s.jahr === last.jahr - span)
    if (!basis) continue
    alle.push(...kandidatenFuerFenster(sorted, last, basis))
  }

  const y1Basis = sorted[sorted.length - 2]!
  const y1Kand = kandidatenFuerFenster(sorted, last, y1Basis)
  const y1Best = waehleBesten(y1Kand)

  const multi = alle.filter((k) => k.fensterJahre >= 2)
  const bestMulti = waehleBesten(multi)
  const best = bestMulti ?? waehleBesten(alle)

  const incrementalRoicPct =
    best != null
      ? best.pct
      : y1Best != null && Math.abs(y1Best.pct) <= 300
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
    return {
      incrementalRoicPct: null,
      incrementalRoic1yPct: null,
      incrementalRoic5yPct: null,
      fensterJahre: null,
      quelle: null,
      methode: null,
    }
  }
  return paketAusSnaps(snapsAusYahoo(hist), 'yahoo')
}
