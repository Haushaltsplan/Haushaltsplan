import { gewichtungAusSlices, type GewichtungEintrag } from '@/lib/portfolio-analyse/gewichtung'
import { isinSektorName } from '@/lib/portfolio-analyse/isin-sektoren'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { normalisiereRegion } from '@/lib/portfolio-analyse/region-normalisierung'
import { normalisiereSektor } from '@/lib/portfolio-analyse/sektor-normalisierung'
import type { AllocationSlice, EtfBreakdown, SinglePortfolioReport } from '@/lib/portfolio-analyse/parqet-core/types'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/
const PALETTE = [
  '#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185', '#60a5fa',
]

export type XrayGliederungEintrag = {
  key: string
  label: string
  symbol: string | null
  isin: string | null
  wertEur: number
  gewichtProzent: number
}

export type XrayGruppenAnsicht = {
  eintraege: GewichtungEintrag[]
  gliederung: Map<string, XrayGliederungEintrag[]>
  summeProzent: number
  nichtAufgeloestEur: number
}

function symbolSektorMap(etfBreakdowns: Map<string, EtfBreakdown>): Map<string, string> {
  const m = new Map<string, string>()
  for (const bd of etfBreakdowns.values()) {
    for (const h of bd.topHoldings) {
      if (!h.sectorName || !h.symbol) continue
      const sym = h.symbol.trim().toUpperCase()
      const sec = normalisiereSektor(h.sectorName)
      m.set(sym, sec)
      m.set(sym.split('.')[0]!, sec)
    }
  }
  return m
}

function sektorFuerSlice(
  slice: AllocationSlice,
  posByIsin: Map<string, LivePosition>,
  symbolZuIsin: Map<string, string>,
  symbolSektor: Map<string, string>,
  fehlendeIsins: Set<string>,
): string {
  const key = slice.key.trim().toUpperCase()
  if (ISIN_RE.test(key)) {
    if (fehlendeIsins.has(key)) return 'Nicht aufgelöst'
    return normalisiereSektor(isinSektorName(key) ?? (posByIsin.get(key)?.assetKlasse === 'etf' ? 'ETF & Fonds' : undefined))
  }
  const isin = symbolZuIsin.get(key) ?? symbolZuIsin.get(key.split('.')[0]!)
  if (isin) return normalisiereSektor(isinSektorName(isin))
  const symSec = symbolSektor.get(key) ?? symbolSektor.get(key.split('.')[0]!)
  if (symSec) return symSec
  return 'Sonstige'
}

function regionFuerSlice(
  slice: AllocationSlice,
  posByIsin: Map<string, LivePosition>,
  symbolZuIsin: Map<string, string>,
  fehlendeIsins: Set<string>,
): string {
  const key = slice.key.trim().toUpperCase()
  if (fehlendeIsins.has(key)) return 'Nicht aufgelöst'
  if (ISIN_RE.test(key)) {
    const isin = key
    if (isin.startsWith('DE')) return 'Deutschland'
    if (isin.startsWith('FR')) return 'Frankreich'
    if (isin.startsWith('NL')) return 'Niederlande'
    if (isin.startsWith('CH')) return 'Schweiz'
    if (isin.startsWith('US')) return 'Vereinigte Staaten'
  }
  const isin = symbolZuIsin.get(key) ?? symbolZuIsin.get(key.split('.')[0]!)
  if (isin) {
    if (isin.startsWith('DE')) return 'Deutschland'
    if (isin.startsWith('FR')) return 'Frankreich'
    if (isin.startsWith('NL')) return 'Niederlande'
    if (isin.startsWith('CH')) return 'Schweiz'
    if (isin.startsWith('US')) return 'Vereinigte Staaten'
  }
  return normalisiereRegion(key)
}

function baueGruppenAnsicht(
  slices: AllocationSlice[],
  posByIsin: Map<string, LivePosition>,
  symbolZuIsin: Map<string, string>,
  symbolSektor: Map<string, string>,
  depotwertEur: number,
  fehlendeEtf: LivePosition[],
  gruppeFn: (slice: AllocationSlice) => string,
): XrayGruppenAnsicht {
  const gruppen = new Map<string, { wertEur: number; holdings: XrayGliederungEintrag[] }>()
  const basis = depotwertEur > 0 ? depotwertEur : 1

  for (const slice of slices) {
    if (slice.valueEUR <= 0 && slice.weightPercent <= 0) continue
    const gruppe = gruppeFn(slice)
    const wert = slice.valueEUR > 0 ? slice.valueEUR : (basis * slice.weightPercent) / 100
    const pct = (wert / basis) * 100

    const isin =
      ISIN_RE.test(slice.key.toUpperCase())
        ? slice.key.toUpperCase()
        : symbolZuIsin.get(slice.key.toUpperCase()) ??
          symbolZuIsin.get(slice.key.toUpperCase().split('.')[0]!) ??
          null

    const holding: XrayGliederungEintrag = {
      key: slice.key,
      label: slice.label,
      symbol: isin ? null : slice.key,
      isin,
      wertEur: Math.round(wert * 100) / 100,
      gewichtProzent: Math.round(pct * 100) / 100,
    }

    const cur = gruppen.get(gruppe) ?? { wertEur: 0, holdings: [] }
    cur.wertEur += wert
    cur.holdings.push(holding)
    gruppen.set(gruppe, cur)
  }

  let nichtAufgeloestEur = 0
  for (const p of fehlendeEtf) {
    nichtAufgeloestEur += p.wertLiveEur
  }

  const gliederung = new Map<string, XrayGliederungEintrag[]>()
  const eintraege: GewichtungEintrag[] = [...gruppen.entries()]
    .sort((a, b) => b[1].wertEur - a[1].wertEur)
    .map(([label, data], i) => {
      const holdings = data.holdings.sort((a, b) => b.wertEur - a.wertEur)
      gliederung.set(label, holdings)
      const gewichtProzent = Math.round((data.wertEur / basis) * 10000) / 100
      return {
        key: label,
        label,
        wertEur: Math.round(data.wertEur * 100) / 100,
        gewichtProzent,
        anzahl: holdings.length,
        farbe: PALETTE[i % PALETTE.length],
      }
    })

  const summeProzent = eintraege.reduce((s, e) => s + e.gewichtProzent, 0)
  return {
    eintraege,
    gliederung,
    summeProzent: Math.round(summeProzent * 100) / 100,
    nichtAufgeloestEur: Math.round(nichtAufgeloestEur * 100) / 100,
  }
}

function lookupMaps(positionen: LivePosition[], meta: Map<string, IsinMetadata>) {
  const posByIsin = new Map<string, LivePosition>()
  const symbolZuIsin = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin?.trim().toUpperCase()
    if (!isin) continue
    posByIsin.set(isin, p)
    const sym = (p.symbolYahoo ?? meta.get(isin)?.symbolYahoo)?.trim().toUpperCase()
    if (!sym) continue
    symbolZuIsin.set(sym, isin)
    symbolZuIsin.set(sym.split('.')[0]!, isin)
  }
  return { posByIsin, symbolZuIsin }
}

/** X-Ray: Look-through — ETFs verschwinden, Einzelwerte werden zusammengeführt. */
export function gewichtungMitXray(
  report: SinglePortfolioReport | null,
  xrayAn: boolean,
): { eintraege: GewichtungEintrag[]; istLookthrough: boolean } {
  if (!report || !xrayAn) {
    return { eintraege: [], istLookthrough: false }
  }

  const slices = report.xRay.topHoldings.filter((h) => h.valueEUR > 0 || h.weightPercent > 0)
  if (slices.length === 0) {
    return { eintraege: [], istLookthrough: false }
  }

  const etfAnzahl = report.holdings.filter((h) => h.assetType === 'ETF').length
  const istLookthrough = slices.length > report.holdings.length - etfAnzahl || etfAnzahl > 0
  return {
    eintraege: gewichtungAusSlices(slices),
    istLookthrough,
  }
}

export function baueXraySektorAnsicht(
  report: SinglePortfolioReport | null,
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  etfBreakdowns: Map<string, EtfBreakdown>,
  depotwertEur: number,
  fehlendeEtf: LivePosition[],
): XrayGruppenAnsicht | null {
  if (!report) return null
  const slices = report.xRay.topHoldings.filter((h) => h.valueEUR > 0 || h.weightPercent > 0)
  if (!slices.length && !fehlendeEtf.length) return null

  const { posByIsin, symbolZuIsin } = lookupMaps(positionen, meta)
  const symbolSektor = symbolSektorMap(etfBreakdowns)
  const fehlendeIsins = new Set(
    fehlendeEtf.map((p) => p.isin?.trim().toUpperCase()).filter((x): x is string => Boolean(x)),
  )

  return baueGruppenAnsicht(
    slices,
    posByIsin,
    symbolZuIsin,
    symbolSektor,
    depotwertEur,
    fehlendeEtf,
    (slice) => sektorFuerSlice(slice, posByIsin, symbolZuIsin, symbolSektor, fehlendeIsins),
  )
}

export function baueXrayRegionAnsicht(
  report: SinglePortfolioReport | null,
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  etfBreakdowns: Map<string, EtfBreakdown>,
  depotwertEur: number,
  fehlendeEtf: LivePosition[],
): XrayGruppenAnsicht | null {
  if (!report) return null
  const slices = report.xRay.topHoldings.filter((h) => h.valueEUR > 0 || h.weightPercent > 0)
  if (!slices.length && !fehlendeEtf.length) return null

  const { posByIsin, symbolZuIsin } = lookupMaps(positionen, meta)
  const symbolSektor = symbolSektorMap(etfBreakdowns)
  const fehlendeIsins = new Set(
    fehlendeEtf.map((p) => p.isin?.trim().toUpperCase()).filter((x): x is string => Boolean(x)),
  )

  return baueGruppenAnsicht(
    slices,
    posByIsin,
    symbolZuIsin,
    symbolSektor,
    depotwertEur,
    fehlendeEtf,
    (slice) => regionFuerSlice(slice, posByIsin, symbolZuIsin, fehlendeIsins),
  )
}

export function etfOhneBreakdown(
  positionen: LivePosition[],
  etfBreakdowns: Map<string, EtfBreakdown>,
): LivePosition[] {
  return positionen.filter(
    (p) =>
      p.assetKlasse === 'etf' &&
      p.isin &&
      p.wertLiveEur > 0 &&
      !etfBreakdowns.has(p.isin.trim().toUpperCase()),
  )
}
