import { gewichtungAusSlices, type GewichtungEintrag } from '@/lib/portfolio-analyse/gewichtung'
import { isinSektorName, sektorFuerPosition } from '@/lib/portfolio-analyse/isin-sektoren'
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

type SektorMaps = {
  symbol: Map<string, string>
  name: Map<string, string>
}

function baueSektorMaps(etfBreakdowns: Map<string, EtfBreakdown>, extra: Map<string, string>): SektorMaps {
  const symbol = new Map<string, string>()
  const name = new Map<string, string>()

  for (const bd of etfBreakdowns.values()) {
    for (const h of bd.topHoldings) {
      if (!h.sectorName) continue
      const sec = normalisiereSektor(h.sectorName)
      if (h.symbol) {
        const sym = h.symbol.trim().toUpperCase()
        symbol.set(sym, sec)
        symbol.set(sym.split('.')[0]!, sec)
      }
      if (h.name) {
        name.set(h.name.trim().toLowerCase(), sec)
      }
    }
  }

  for (const [sym, sec] of extra.entries()) {
    const s = sym.trim().toUpperCase()
    symbol.set(s, normalisiereSektor(sec))
    symbol.set(s.split('.')[0]!, normalisiereSektor(sec))
  }

  return { symbol, name }
}

function sektorAusMaps(
  key: string,
  label: string,
  symbol: string | null,
  maps: SektorMaps,
): string | null {
  const k = key.trim().toUpperCase()
  const kBase = k.split('.')[0]!
  const sym = symbol?.trim().toUpperCase()
  const symBase = sym?.split('.')[0]

  const hit =
    maps.symbol.get(k) ??
    maps.symbol.get(kBase) ??
    (sym ? (maps.symbol.get(sym) ?? maps.symbol.get(symBase!)) : null) ??
    maps.name.get(label.trim().toLowerCase())
  return hit ?? null
}

function sektorFuerSlice(
  slice: AllocationSlice,
  posByIsin: Map<string, LivePosition>,
  symbolZuIsin: Map<string, string>,
  maps: SektorMaps,
  fehlendeIsins: Set<string>,
): string {
  const key = slice.key.trim().toUpperCase()
  const keyBase = key.split('.')[0]!
  const sliceSymbol = ISIN_RE.test(key) ? null : key

  if (ISIN_RE.test(key)) {
    if (fehlendeIsins.has(key)) return 'Nicht aufgelöst'
    const manuell = isinSektorName(key)
    if (manuell) return normalisiereSektor(manuell)
    if (posByIsin.get(key)?.assetKlasse === 'etf') return 'ETF & Fonds'
    return 'Sonstige'
  }

  const isin = symbolZuIsin.get(key) ?? symbolZuIsin.get(keyBase)
  if (isin) {
    const manuell = isinSektorName(isin)
    if (manuell) return normalisiereSektor(manuell)
  }

  const mapped = sektorAusMaps(key, slice.label, sliceSymbol, maps)
  if (mapped) return mapped

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

function sliceAusPosition(p: LivePosition, depotwertEur: number): AllocationSlice {
  const basis = depotwertEur > 0 ? depotwertEur : 1
  return {
    key: p.isin?.trim().toUpperCase() ?? p.anzeigeName,
    label: p.anzeigeName,
    weightPercent: Math.round((p.wertLiveEur / basis) * 10000) / 100,
    valueEUR: Math.round(p.wertLiveEur * 100) / 100,
  }
}

function baueGruppenAnsicht(
  slices: AllocationSlice[],
  posByIsin: Map<string, LivePosition>,
  symbolZuIsin: Map<string, string>,
  maps: SektorMaps,
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

function fehlendeIsins(fehlendeEtf: LivePosition[]): Set<string> {
  return new Set(
    fehlendeEtf.map((p) => p.isin?.trim().toUpperCase()).filter((x): x is string => Boolean(x)),
  )
}

/** Symbole aus „Sonstige“-Bucket für Nachladen via Yahoo. */
export function sonstigeSymbole(ansicht: XrayGruppenAnsicht | null): string[] {
  const holdings = ansicht?.gliederung.get('Sonstige') ?? []
  const out: string[] = []
  for (const h of holdings) {
    if (h.symbol) out.push(h.symbol)
    else if (h.key && !ISIN_RE.test(h.key.toUpperCase())) out.push(h.key)
    else if (h.isin) {
      // ISIN-only: kein Ticker bekannt
    }
  }
  return out
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

export function baueSektorAnsichtAusPositionen(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  etfBreakdowns: Map<string, EtfBreakdown>,
  depotwertEur: number,
  extraSektor: Map<string, string> = new Map(),
): XrayGruppenAnsicht {
  const slices = positionen.filter((p) => p.wertLiveEur > 0).map((p) => sliceAusPosition(p, depotwertEur))
  const { posByIsin, symbolZuIsin } = lookupMaps(positionen, meta)
  const maps = baueSektorMaps(etfBreakdowns, extraSektor)

  return baueGruppenAnsicht(
    slices,
    posByIsin,
    symbolZuIsin,
    maps,
    depotwertEur,
    [],
    (slice) => {
      const key = slice.key.trim().toUpperCase()
      if (ISIN_RE.test(key)) {
        const pos = posByIsin.get(key)
        if (pos) return normalisiereSektor(sektorFuerPosition(pos))
      }
      return sektorFuerSlice(slice, posByIsin, symbolZuIsin, maps, new Set())
    },
  )
}

export function baueRegionAnsichtAusPositionen(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  depotwertEur: number,
): XrayGruppenAnsicht {
  const slices = positionen.filter((p) => p.wertLiveEur > 0).map((p) => sliceAusPosition(p, depotwertEur))
  const { posByIsin, symbolZuIsin } = lookupMaps(positionen, meta)
  const maps = baueSektorMaps(new Map(), new Map())

  return baueGruppenAnsicht(
    slices,
    posByIsin,
    symbolZuIsin,
    maps,
    depotwertEur,
    [],
    (slice) => regionFuerSlice(slice, posByIsin, symbolZuIsin, new Set()),
  )
}

export function baueXraySektorAnsicht(
  report: SinglePortfolioReport | null,
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  etfBreakdowns: Map<string, EtfBreakdown>,
  depotwertEur: number,
  fehlendeEtf: LivePosition[],
  extraSektor: Map<string, string> = new Map(),
): XrayGruppenAnsicht | null {
  if (!report) return null
  const slices = report.xRay.topHoldings.filter((h) => h.valueEUR > 0 || h.weightPercent > 0)
  if (!slices.length && !fehlendeEtf.length) return null

  const { posByIsin, symbolZuIsin } = lookupMaps(positionen, meta)
  const maps = baueSektorMaps(etfBreakdowns, extraSektor)

  return baueGruppenAnsicht(
    slices,
    posByIsin,
    symbolZuIsin,
    maps,
    depotwertEur,
    fehlendeEtf,
    (slice) => sektorFuerSlice(slice, posByIsin, symbolZuIsin, maps, fehlendeIsins(fehlendeEtf)),
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
  const maps = baueSektorMaps(etfBreakdowns, new Map())

  return baueGruppenAnsicht(
    slices,
    posByIsin,
    symbolZuIsin,
    maps,
    depotwertEur,
    fehlendeEtf,
    (slice) => regionFuerSlice(slice, posByIsin, symbolZuIsin, fehlendeIsins(fehlendeEtf)),
  )
}

export function baueSektorAnsicht(
  report: SinglePortfolioReport | null,
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  etfBreakdowns: Map<string, EtfBreakdown>,
  depotwertEur: number,
  fehlendeEtf: LivePosition[],
  xrayAn: boolean,
  extraSektor: Map<string, string> = new Map(),
): XrayGruppenAnsicht | null {
  if (xrayAn && report) {
    return baueXraySektorAnsicht(
      report,
      positionen,
      meta,
      etfBreakdowns,
      depotwertEur,
      fehlendeEtf,
      extraSektor,
    )
  }
  return baueSektorAnsichtAusPositionen(positionen, meta, etfBreakdowns, depotwertEur, extraSektor)
}

export function baueRegionAnsicht(
  report: SinglePortfolioReport | null,
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  etfBreakdowns: Map<string, EtfBreakdown>,
  depotwertEur: number,
  fehlendeEtf: LivePosition[],
  xrayAn: boolean,
): XrayGruppenAnsicht | null {
  if (xrayAn && report) {
    return baueXrayRegionAnsicht(report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf)
  }
  return baueRegionAnsichtAusPositionen(positionen, meta, depotwertEur)
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
