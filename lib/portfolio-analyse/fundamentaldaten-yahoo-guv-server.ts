/** GuV-/Cashflow-Historie aus Yahoo fundamentals-timeseries (Fallback z. B. Hermès). */

import 'server-only'

import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  EU_GUV_FALLBACK_ISINS,
} from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import {
  ladeStockanalysisGuVHistorie,
  type StockanalysisJahresForecastEintrag,
} from '@/lib/portfolio-analyse/stockanalysis-forecast-server'
import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

export const HERMES_YAHOO_ISIN = 'FR0000052292'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; daten: YahooGuVRoh | null }>()

const GUV_ANNUAL_TYPES = [
  'annualTotalRevenue',
  'annualGrossProfit',
  'annualNormalizedEBITDA',
  'annualEBITDA',
  'annualOperatingIncome',
  'annualNetIncomeCommonStockholders',
  'annualNetIncome',
  'annualDilutedEPS',
  'annualSellingGeneralAndAdministration',
  'annualResearchAndDevelopment',
  'annualOperatingCashFlow',
  'annualCapitalExpenditure',
  'annualFreeCashFlow',
  'annualDilutedAverageShares',
  'annualBasicAverageShares',
  'trailingTotalRevenue',
  'trailingGrossProfit',
  'trailingEBITDA',
  'trailingOperatingIncome',
  'trailingNetIncome',
  'trailingDilutedEPS',
  'trailingSellingGeneralAndAdministration',
  'trailingOperatingCashFlow',
  'trailingCapitalExpenditure',
  'trailingFreeCashFlow',
] as const

const YAHOO_GUV_ZEILEN_IDS = new Set([
  'umsatz',
  'bruttogewinn',
  'ebitda',
  'ebit',
  'nettogewinn',
  'eps',
  'sga',
  'rd',
  'aktien',
  'ocf',
  'capex',
  'fcf',
])

type TimeseriesBlock = {
  meta?: { type?: string[] }
  [key: string]: unknown
}

type TimeseriesPunkt = {
  asOfDate?: string
  reportedValue?: { raw?: number }
}

type YahooGuVRoh = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
}

function blockFuerTyp(result: TimeseriesBlock[], typ: string): TimeseriesBlock | undefined {
  return result.find((b) => b.meta?.type?.[0] === typ)
}

function punkteAusTypen(result: TimeseriesBlock[], ...typen: string[]): TimeseriesPunkt[] {
  for (const typ of typen) {
    const block = blockFuerTyp(result, typ)
    const t = block?.meta?.type?.[0]
    const arr = t && Array.isArray(block?.[t]) ? (block[t] as TimeseriesPunkt[]) : []
    if (arr.length > 0) return arr
  }
  return []
}

function werteNachDatum(punkte: TimeseriesPunkt[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of punkte) {
    const d = p.asOfDate?.trim()
    const raw = p.reportedValue?.raw
    if (d && raw != null && Number.isFinite(raw)) m.set(d, raw)
  }
  return m
}

function letzterTrailing(result: TimeseriesBlock[], ...typen: string[]): number | null {
  const punkte = punkteAusTypen(result, ...typen)
  if (punkte.length === 0) return null
  const raw = punkte[punkte.length - 1]?.reportedValue?.raw
  return raw != null && Number.isFinite(raw) ? raw : null
}

function zuMio(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  return raw / 1_000_000
}

function zuAktienMio(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  return raw / 1_000_000
}

async function ladeTimeseriesResult(symbol: string): Promise<TimeseriesBlock[]> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return []

  const period1 = Math.floor(new Date('2005-01-01').getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const u = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
  )
  u.searchParams.set('symbol', symbol)
  u.searchParams.set('type', GUV_ANNUAL_TYPES.join(','))
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))
  u.searchParams.set('crumb', auth.crumb)

  const res = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []

  const j = (await res.json()) as { timeseries?: { result?: TimeseriesBlock[] } }
  return j.timeseries?.result ?? []
}

function baueZeile(
  id: string,
  label: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  einheit: FundamentalMetrikZeile['einheit'],
  periodenIso: string[],
  werteMap: Map<string, number>,
  ttm: number | null,
): FundamentalMetrikZeile {
  const werte: Record<string, number | null> = {}
  for (const iso of periodenIso) {
    const v = werteMap.get(iso)
    werte[iso] = v != null && Number.isFinite(v) ? v : null
  }
  if (ttm != null && Number.isFinite(ttm)) werte[FUNDAMENTAL_TTM_KEY] = ttm
  return {
    id,
    label,
    gruppe,
    einheit,
    werte,
    macrotrendsStatement: gruppe === 'cashflow' ? 'cash-flow-statement' : 'income-statement',
  }
}

async function baueYahooGuVRoh(symbol: string): Promise<YahooGuVRoh | null> {
  const sym = symbol.trim().toUpperCase()
  const cached = cache.get(sym)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.daten

  const result = await ladeTimeseriesResult(sym)
  if (result.length === 0) {
    cache.set(sym, { at: Date.now(), daten: null })
    return null
  }

  const revenue = werteNachDatum(punkteAusTypen(result, 'annualTotalRevenue'))
  const gross = werteNachDatum(punkteAusTypen(result, 'annualGrossProfit'))
  const ebitda = werteNachDatum(
    punkteAusTypen(result, 'annualNormalizedEBITDA', 'annualEBITDA'),
  )
  const ebit = werteNachDatum(punkteAusTypen(result, 'annualOperatingIncome'))
  const net = werteNachDatum(
    punkteAusTypen(result, 'annualNetIncomeCommonStockholders', 'annualNetIncome'),
  )
  const eps = werteNachDatum(punkteAusTypen(result, 'annualDilutedEPS'))
  const sga = werteNachDatum(punkteAusTypen(result, 'annualSellingGeneralAndAdministration'))
  const rd = werteNachDatum(punkteAusTypen(result, 'annualResearchAndDevelopment'))
  const ocf = werteNachDatum(punkteAusTypen(result, 'annualOperatingCashFlow'))
  const capex = werteNachDatum(punkteAusTypen(result, 'annualCapitalExpenditure'))
  const fcfRaw = werteNachDatum(punkteAusTypen(result, 'annualFreeCashFlow'))
  const shares = werteNachDatum(
    punkteAusTypen(result, 'annualDilutedAverageShares', 'annualBasicAverageShares'),
  )

  const periodenIso = [...new Set([...revenue.keys(), ...ebit.keys(), ...net.keys()])].sort()
  if (periodenIso.length < 2) {
    cache.set(sym, { at: Date.now(), daten: null })
    return null
  }

  const umsatzMio = new Map<string, number>()
  const bruttoMio = new Map<string, number>()
  const ebitdaMio = new Map<string, number>()
  const ebitMio = new Map<string, number>()
  const nettoMio = new Map<string, number>()
  const epsMap = new Map<string, number>()
  const sgaMio = new Map<string, number>()
  const rdMio = new Map<string, number>()
  const ocfMio = new Map<string, number>()
  const capexMio = new Map<string, number>()
  const fcfMio = new Map<string, number>()
  const aktienMio = new Map<string, number>()

  for (const iso of periodenIso) {
    const u = zuMio(revenue.get(iso))
    if (u != null) umsatzMio.set(iso, u)
    const g = zuMio(gross.get(iso))
    if (g != null) bruttoMio.set(iso, g)
    const eb = zuMio(ebitda.get(iso))
    if (eb != null) ebitdaMio.set(iso, eb)
    const ei = zuMio(ebit.get(iso))
    if (ei != null) ebitMio.set(iso, ei)
    const ni = zuMio(net.get(iso))
    if (ni != null) nettoMio.set(iso, ni)
    const e = eps.get(iso)
    if (e != null) epsMap.set(iso, e)
    const s = zuMio(sga.get(iso))
    if (s != null) sgaMio.set(iso, s)
    const r = zuMio(rd.get(iso))
    if (r != null) rdMio.set(iso, r)
    const o = zuMio(ocf.get(iso))
    if (o != null) ocfMio.set(iso, o)
    const c = zuMio(capex.get(iso))
    if (c != null) capexMio.set(iso, c)
    const f = zuMio(fcfRaw.get(iso))
    if (f != null) {
      fcfMio.set(iso, f)
    } else if (o != null && c != null) {
      fcfMio.set(iso, o + c)
    }
    const sh = zuAktienMio(shares.get(iso))
    if (sh != null) aktienMio.set(iso, sh)
  }

  const ttmUmsatz = zuMio(letzterTrailing(result, 'trailingTotalRevenue'))
  const ttmBrutto = zuMio(letzterTrailing(result, 'trailingGrossProfit'))
  const ttmEbitda = zuMio(letzterTrailing(result, 'trailingEBITDA', 'trailingNormalizedEBITDA'))
  const ttmEbit = zuMio(letzterTrailing(result, 'trailingOperatingIncome'))
  const ttmNetto = zuMio(letzterTrailing(result, 'trailingNetIncome'))
  const ttmEps = letzterTrailing(result, 'trailingDilutedEPS')
  const ttmSga = zuMio(letzterTrailing(result, 'trailingSellingGeneralAndAdministration'))
  const ttmOcf = zuMio(letzterTrailing(result, 'trailingOperatingCashFlow'))
  const ttmCapex = zuMio(letzterTrailing(result, 'trailingCapitalExpenditure'))
  const ttmFcfRaw = zuMio(letzterTrailing(result, 'trailingFreeCashFlow'))
  const ttmFcf =
    ttmFcfRaw ?? (ttmOcf != null && ttmCapex != null ? ttmOcf + ttmCapex : null)

  const perioden: FundamentalPeriode[] = periodenIso.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, 'jahr'),
  }))
  perioden.push({ iso: FUNDAMENTAL_TTM_KEY, label: 'TTM', istLtm: true })

  const zeilen: FundamentalMetrikZeile[] = [
    baueZeile('umsatz', 'Umsatz', 'finanzdaten', 'waehrung_usd_mio', periodenIso, umsatzMio, ttmUmsatz),
    baueZeile('bruttogewinn', 'Bruttogewinn', 'finanzdaten', 'waehrung_usd_mio', periodenIso, bruttoMio, ttmBrutto),
    baueZeile('ebitda', 'EBITDA', 'finanzdaten', 'waehrung_usd_mio', periodenIso, ebitdaMio, ttmEbitda),
    baueZeile('ebit', 'EBIT', 'finanzdaten', 'waehrung_usd_mio', periodenIso, ebitMio, ttmEbit),
    baueZeile('nettogewinn', 'Nettogewinn', 'finanzdaten', 'waehrung_usd_mio', periodenIso, nettoMio, ttmNetto),
    baueZeile('eps', 'EPS (verwässert)', 'finanzdaten', 'waehrung_usd_aktie', periodenIso, epsMap, ttmEps),
    baueZeile('sga', 'SG&A (Vertrieb & Verwaltung)', 'finanzdaten', 'waehrung_usd_mio', periodenIso, sgaMio, ttmSga),
    baueZeile('ocf', 'Operativer Cashflow', 'cashflow', 'waehrung_usd_mio', periodenIso, ocfMio, ttmOcf),
    baueZeile('capex', 'CapEx (Investitionen)', 'cashflow', 'waehrung_usd_mio', periodenIso, capexMio, ttmCapex),
    baueZeile('fcf', 'Free Cashflow (FCF)', 'cashflow', 'waehrung_usd_mio', periodenIso, fcfMio, ttmFcf),
    baueZeile('aktien', 'Ausstehende Aktien', 'finanzdaten', 'aktien_mio', periodenIso, aktienMio, null),
  ]

  if (rdMio.size > 0) {
    zeilen.splice(6, 0, baueZeile('rd', 'Forschung & Entwicklung (R&D)', 'finanzdaten', 'waehrung_usd_mio', periodenIso, rdMio, null))
  }

  const daten = { perioden, zeilen }
  cache.set(sym, { at: Date.now(), daten })
  return daten
}

export function nutzeYahooGuVFuerIsin(isin: string | null | undefined): boolean {
  const norm = loesePortfolioIsin({ isin }) ?? isin?.trim().toUpperCase()
  return norm != null && EU_GUV_FALLBACK_ISINS.has(norm)
}

function pickWert(...kandidaten: Array<number | null | undefined>): number | null {
  for (const v of kandidaten) {
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

function guvRohAusStockanalysis(reihe: StockanalysisJahresForecastEintrag[]): YahooGuVRoh | null {
  if (reihe.length < 2) return null

  const periodenIso = reihe.map((r) => r.periodenEnde)
  const perioden: FundamentalPeriode[] = periodenIso.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, 'jahr'),
  }))

  const maps = {
    umsatz: new Map<string, number>(),
    bruttogewinn: new Map<string, number>(),
    ebit: new Map<string, number>(),
    nettogewinn: new Map<string, number>(),
    eps: new Map<string, number>(),
    fcf: new Map<string, number>(),
  }

  for (const r of reihe) {
    const iso = r.periodenEnde
    const u = zuMio(r.umsatzUsd)
    if (u != null) maps.umsatz.set(iso, u)
    const g = zuMio(r.grossProfitUsd)
    if (g != null) maps.bruttogewinn.set(iso, g)
    const e = zuMio(r.operatingIncomeUsd)
    if (e != null) maps.ebit.set(iso, e)
    const n = zuMio(r.netIncomeUsd)
    if (n != null) maps.nettogewinn.set(iso, n)
    if (r.eps != null) maps.eps.set(iso, r.eps)
    const f = zuMio(r.freeCashFlowUsd)
    if (f != null) maps.fcf.set(iso, f)
  }

  const zeilen: FundamentalMetrikZeile[] = [
    baueZeile('umsatz', 'Umsatz', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.umsatz, null),
    baueZeile('bruttogewinn', 'Bruttogewinn', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.bruttogewinn, null),
    baueZeile('ebit', 'EBIT', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.ebit, null),
    baueZeile('nettogewinn', 'Nettogewinn', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.nettogewinn, null),
    baueZeile('eps', 'EPS (verwässert)', 'finanzdaten', 'waehrung_usd_aktie', periodenIso, maps.eps, null),
    baueZeile('fcf', 'Free Cashflow (FCF)', 'cashflow', 'waehrung_usd_mio', periodenIso, maps.fcf, null),
  ]

  return { perioden, zeilen }
}

/** Macrotrends-GuV/Cashflow durch StockAnalysis, Yahoo & Macrotrends ergänzen (Hermès). */
export async function ergaenzeMacrotrendsMitYahooGuV(
  roh: MacrotrendsFundamentalRoh,
  symbolYahoo: string,
  opts?: { isin?: string | null; firmenname?: string | null; ticker?: string | null },
): Promise<MacrotrendsFundamentalRoh> {
  const [saReihe, yahooRoh] = await Promise.all([
    ladeStockanalysisGuVHistorie({
      symbolYahoo,
      isin: opts?.isin,
      firmenname: opts?.firmenname,
      ticker: opts?.ticker,
    }),
    baueYahooGuVRoh(symbolYahoo),
  ])
  const saRoh = guvRohAusStockanalysis(saReihe)

  if (!saRoh && !yahooRoh) return roh

  const saHist = saRoh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const yahooHist = yahooRoh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const mtHist = roh.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm)

  const histIso = [
    ...new Set([...saHist.map((p) => p.iso), ...yahooHist.map((p) => p.iso), ...mtHist.map((p) => p.iso)]),
  ].sort()

  const ttm =
    yahooRoh?.perioden.find((p) => p.istLtm) ?? roh.perioden.find((p) => p.istLtm)

  const perioden: FundamentalPeriode[] = histIso.map((iso) => {
    const hit =
      saHist.find((p) => p.iso === iso) ??
      yahooHist.find((p) => p.iso === iso) ??
      mtHist.find((p) => p.iso === iso)
    return hit ?? { iso, label: formatFundamentalPeriodeLabel(iso, 'jahr') }
  })
  if (ttm) perioden.push(ttm)

  const saById = new Map(saRoh?.zeilen.map((z) => [z.id, z]) ?? [])
  const yahooById = new Map(yahooRoh?.zeilen.map((z) => [z.id, z]) ?? [])
  const mergedZeilen: FundamentalMetrikZeile[] = []

  for (const z of roh.zeilen) {
    if (YAHOO_GUV_ZEILEN_IDS.has(z.id)) {
      const sz = saById.get(z.id)
      const yz = yahooById.get(z.id)
      const werte: Record<string, number | null> = {}
      for (const iso of histIso) {
        werte[iso] = pickWert(sz?.werte[iso], yz?.werte[iso], z.werte[iso])
      }
      if (ttm) {
        werte[FUNDAMENTAL_TTM_KEY] = pickWert(
          yz?.werte[FUNDAMENTAL_TTM_KEY],
          z.werte[FUNDAMENTAL_TTM_KEY],
        )
      }
      mergedZeilen.push({ ...z, werte })
      saById.delete(z.id)
      yahooById.delete(z.id)
    } else {
      const werte = { ...z.werte }
      for (const iso of histIso) {
        if (!(iso in werte)) werte[iso] = null
      }
      mergedZeilen.push({ ...z, werte })
    }
  }

  for (const z of [...saById.values(), ...yahooById.values()]) {
    if (mergedZeilen.some((m) => m.id === z.id)) continue
    mergedZeilen.push(z)
  }

  return { ...roh, perioden, zeilen: mergedZeilen }
}
