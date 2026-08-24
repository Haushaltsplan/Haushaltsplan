/** GuV-/Cashflow-Historie aus Yahoo + URD (Fallback für EU und dünne Macrotrends-Titel). */

import 'server-only'

import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'
import { baueUmsatzProJahrAusFinanzzeile } from '@/lib/portfolio-analyse/segment-umsatz-abgleich'
import {
  brauchtEuGuVFallback,
} from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { MacrotrendsFundamentalRoh, MacrotrendsIdent } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import {
  ladeStockanalysisGuVHistorie,
  type StockanalysisJahresForecastEintrag,
} from '@/lib/portfolio-analyse/stockanalysis-forecast-server'
import { ladeEuUrdHistorie } from '@/lib/portfolio-analyse/eu-urd-historie-server'
import {
  ladeMarketscreenerGuVChartPaket,
  type MarketscreenerGuVChartPaket,
} from '@/lib/portfolio-analyse/marketscreener-guv-chart-server'
import { ladeStockanalysisStatementsRoh } from '@/lib/portfolio-analyse/stockanalysis-statements-server'
import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'
import { yahooKennzahlenSymbolKandidaten } from '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'

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
  'annualStockholdersEquity',
  'annualTotalStockholderEquity',
  'annualGoodwill',
  'annualDepreciationAmortizationInIncomeStatement',
  'annualDepreciationAndAmortization',
  'annualAccountsReceivable',
  'annualNetAccountsReceivable',
  'annualInventory',
  'annualCurrentAssets',
  'annualTotalAssets',
  'annualTotalDebt',
  'annualCashAndCashEquivalents',
  'annualCashCashEquivalentsAndShortTermInvestments',
  'annualStockBasedCompensation',
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
  'da',
  'sbc',
  'aktien',
  'ocf',
  'capex',
  'fcf',
  'eigenkapital',
  'roe',
  'goodwill',
  'forderungen',
  'vorraete',
  'bargeld',
  'umlaufvermoegen',
  'gesamtvermoegen',
  'gesamtverschuldung',
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
    macrotrendsStatement:
      gruppe === 'cashflow'
        ? 'cash-flow-statement'
        : gruppe === 'bilanz'
          ? 'balance-sheet'
          : 'income-statement',
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
  const daRaw = werteNachDatum(
    punkteAusTypen(
      result,
      'annualDepreciationAmortizationInIncomeStatement',
      'annualDepreciationAndAmortization',
    ),
  )
  const ocf = werteNachDatum(punkteAusTypen(result, 'annualOperatingCashFlow'))
  const capex = werteNachDatum(punkteAusTypen(result, 'annualCapitalExpenditure'))
  const fcfRaw = werteNachDatum(punkteAusTypen(result, 'annualFreeCashFlow'))
  const sbcRaw = werteNachDatum(punkteAusTypen(result, 'annualStockBasedCompensation'))
  const shares = werteNachDatum(
    punkteAusTypen(result, 'annualDilutedAverageShares', 'annualBasicAverageShares'),
  )
  const equity = werteNachDatum(
    punkteAusTypen(result, 'annualStockholdersEquity', 'annualTotalStockholderEquity'),
  )
  const goodwillRaw = werteNachDatum(punkteAusTypen(result, 'annualGoodwill'))
  const recv = werteNachDatum(
    punkteAusTypen(result, 'annualAccountsReceivable', 'annualNetAccountsReceivable'),
  )
  const inv = werteNachDatum(punkteAusTypen(result, 'annualInventory'))
  const cash = werteNachDatum(
    punkteAusTypen(
      result,
      'annualCashAndCashEquivalents',
      'annualCashCashEquivalentsAndShortTermInvestments',
    ),
  )
  const ca = werteNachDatum(punkteAusTypen(result, 'annualCurrentAssets'))
  const assets = werteNachDatum(punkteAusTypen(result, 'annualTotalAssets'))
  const debt = werteNachDatum(punkteAusTypen(result, 'annualTotalDebt'))

  const periodenIso = [
    ...new Set([
      ...revenue.keys(),
      ...ebit.keys(),
      ...net.keys(),
      ...equity.keys(),
      ...assets.keys(),
    ]),
  ].sort()
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
  const daMio = new Map<string, number>()
  const ocfMio = new Map<string, number>()
  const capexMio = new Map<string, number>()
  const fcfMio = new Map<string, number>()
  const sbcMio = new Map<string, number>()
  const aktienMio = new Map<string, number>()
  const equityMio = new Map<string, number>()
  const goodwillMio = new Map<string, number>()
  const forderungenMio = new Map<string, number>()
  const vorraeteMio = new Map<string, number>()
  const bargeldMio = new Map<string, number>()
  const umlaufMio = new Map<string, number>()
  const vermoegenMio = new Map<string, number>()
  const schuldMio = new Map<string, number>()
  const roeMap = new Map<string, number>()

  const putMio = (m: Map<string, number>, iso: string, raw: number | undefined) => {
    const v = zuMio(raw)
    if (v != null) m.set(iso, v)
  }

  for (const iso of periodenIso) {
    putMio(umsatzMio, iso, revenue.get(iso))
    putMio(bruttoMio, iso, gross.get(iso))
    putMio(ebitdaMio, iso, ebitda.get(iso))
    putMio(ebitMio, iso, ebit.get(iso))
    putMio(nettoMio, iso, net.get(iso))
    const e = eps.get(iso)
    if (e != null) epsMap.set(iso, e)
    putMio(sgaMio, iso, sga.get(iso))
    putMio(rdMio, iso, rd.get(iso))
    putMio(daMio, iso, daRaw.get(iso))
    putMio(ocfMio, iso, ocf.get(iso))
    const c = zuMio(capex.get(iso))
    if (c != null) capexMio.set(iso, c)
    const o = ocfMio.get(iso) ?? null
    const f = zuMio(fcfRaw.get(iso))
    if (f != null) fcfMio.set(iso, f)
    else if (o != null && c != null) fcfMio.set(iso, o + c)
    putMio(sbcMio, iso, sbcRaw.get(iso))
    const sh = zuAktienMio(shares.get(iso))
    if (sh != null) aktienMio.set(iso, sh)
    putMio(equityMio, iso, equity.get(iso))
    putMio(goodwillMio, iso, goodwillRaw.get(iso))
    putMio(forderungenMio, iso, recv.get(iso))
    putMio(vorraeteMio, iso, inv.get(iso))
    putMio(bargeldMio, iso, cash.get(iso))
    putMio(umlaufMio, iso, ca.get(iso))
    putMio(vermoegenMio, iso, assets.get(iso))
    putMio(schuldMio, iso, debt.get(iso))
    const ni = nettoMio.get(iso)
    const eq = equityMio.get(iso)
    if (ni != null && eq != null && eq > 0) {
      const roe = (ni / eq) * 100
      if (Number.isFinite(roe) && Math.abs(roe) < 500) roeMap.set(iso, Math.round(roe * 10) / 10)
    }
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

  if (daMio.size > 0) {
    zeilen.splice(
      6,
      0,
      baueZeile('da', 'Abschreibungen (D&A)', 'finanzdaten', 'waehrung_usd_mio', periodenIso, daMio, null),
    )
  }
  if (rdMio.size > 0) {
    zeilen.splice(
      6,
      0,
      baueZeile('rd', 'Forschung & Entwicklung (R&D)', 'finanzdaten', 'waehrung_usd_mio', periodenIso, rdMio, null),
    )
  }
  if (sbcMio.size > 0) {
    zeilen.push(baueZeile('sbc', 'Aktienbasierte Vergütung (SBC)', 'cashflow', 'waehrung_usd_mio', periodenIso, sbcMio, null))
  }
  if (equityMio.size > 0) {
    zeilen.push(
      baueZeile('eigenkapital', 'Eigenkapital', 'bilanz', 'waehrung_usd_mio', periodenIso, equityMio, null),
    )
  }
  if (roeMap.size > 0) {
    zeilen.push(baueZeile('roe', 'Eigenkapitalrendite (ROE %)', 'rentabilitaet', 'prozent', periodenIso, roeMap, null))
  }
  if (goodwillMio.size > 0) {
    zeilen.push(baueZeile('goodwill', 'Goodwill', 'bilanz', 'waehrung_usd_mio', periodenIso, goodwillMio, null))
  }
  if (forderungenMio.size > 0) {
    zeilen.push(
      baueZeile('forderungen', 'Forderungen (netto)', 'bilanz', 'waehrung_usd_mio', periodenIso, forderungenMio, null),
    )
  }
  if (vorraeteMio.size > 0) {
    zeilen.push(baueZeile('vorraete', 'Vorräte', 'bilanz', 'waehrung_usd_mio', periodenIso, vorraeteMio, null))
  }
  if (bargeldMio.size > 0) {
    zeilen.push(
      baueZeile('bargeld', 'Bargeld & Äquivalente', 'bilanz', 'waehrung_usd_mio', periodenIso, bargeldMio, null),
    )
  }
  if (umlaufMio.size > 0) {
    zeilen.push(
      baueZeile('umlaufvermoegen', 'Umlaufvermögen', 'bilanz', 'waehrung_usd_mio', periodenIso, umlaufMio, null),
    )
  }
  if (vermoegenMio.size > 0) {
    zeilen.push(
      baueZeile('gesamtvermoegen', 'Gesamtvermögen', 'bilanz', 'waehrung_usd_mio', periodenIso, vermoegenMio, null),
    )
  }
  if (schuldMio.size > 0) {
    zeilen.push(
      baueZeile(
        'gesamtverschuldung',
        'Gesamtverschuldung',
        'bilanz',
        'waehrung_usd_mio',
        periodenIso,
        schuldMio,
        null,
      ),
    )
  }

  const daten = { perioden, zeilen }
  cache.set(sym, { at: Date.now(), daten })
  return daten
}

export function nutzeYahooGuVFuerIsin(isin: string | null | undefined): boolean {
  const norm = loesePortfolioIsin({ isin }) ?? isin?.trim().toUpperCase()
  return brauchtEuGuVFallback(norm)
}

/**
 * True wenn Macrotrends-GuV/Cashflow/ROE zu dünn oder veraltet ist.
 * Nur noch Diagnose — US-Titel werden nicht mehr mit Yahoo/SA nachgefüllt.
 */
export function brauchtGuVErgaenzung(roh: MacrotrendsFundamentalRoh | null | undefined): boolean {
  if (!roh || roh.zeilen.length === 0) return true
  const hist = roh.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm)
  if (hist.length < 5) return true

  const aktuellesJahr = new Date().getUTCFullYear()
  const letzteJahre = hist.map((p) => parseInt(p.iso.slice(0, 4), 10)).filter(Number.isFinite)
  const maxJahr = letzteJahre.length ? Math.max(...letzteJahre) : 0
  if (maxJahr < aktuellesJahr - 2) return true

  const zaehle = (id: string) => {
    const z = roh.zeilen.find((r) => r.id === id)
    if (!z) return 0
    return hist.filter((p) => z.werte[p.iso] != null && Number.isFinite(z.werte[p.iso]!)).length
  }

  // 12-Jahre-Lücke typischerweise: viele PE-Jahre, aber FCF/ROE nur bis ~2013
  if (zaehle('fcf') < 8) return true
  if (zaehle('roe') < 8) return true
  if (zaehle('umsatz') < 8) return true
  // Dünne GuV-Zeilen (häufig EU): Umsatz da, EBIT/NI leer → mergen
  if (zaehle('ebit') < 3) return true
  if (zaehle('nettogewinn') < 3) return true
  if (zaehle('capex') < 3) return true
  if (zaehle('da') < 2) return true
  if (zaehle('sbc') < 1) return true
  return false
}

function pickWert(...kandidaten: Array<number | null | undefined>): number | null {
  for (const v of kandidaten) {
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

/** Wert aus Zeile — exakt oder ±45 Tage / gleiches Jahr (Macrotrends vs. URD/Yahoo). */
function pickWertFuerIso(
  iso: string,
  ...quellen: Array<Record<string, number | null | undefined> | undefined>
): number | null {
  for (const q of quellen) {
    const v = wertAusMapFuerIso(q, iso)
    if (v != null) return v
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
    ebitda: new Map<string, number>(),
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
    const eb = zuMio(r.ebitdaUsd)
    if (eb != null) maps.ebitda.set(iso, eb)
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
    baueZeile('ebitda', 'EBITDA', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.ebitda, null),
    baueZeile('ebit', 'EBIT', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.ebit, null),
    baueZeile('nettogewinn', 'Nettogewinn', 'finanzdaten', 'waehrung_usd_mio', periodenIso, maps.nettogewinn, null),
    baueZeile('eps', 'EPS (verwässert)', 'finanzdaten', 'waehrung_usd_aktie', periodenIso, maps.eps, null),
    baueZeile('fcf', 'Free Cashflow (FCF)', 'cashflow', 'waehrung_usd_mio', periodenIso, maps.fcf, null),
  ]

  return { perioden, zeilen }
}

function guvRohAusMsChart(paket: MarketscreenerGuVChartPaket | null): YahooGuVRoh | null {
  if (!paket) return null
  const jahre = [
    ...new Set([
      ...paket.bruttogewinnUsd.map((r) => r.jahr),
      ...paket.ebitdaUsd.map((r) => r.jahr),
      ...paket.ebitUsd.map((r) => r.jahr),
      ...paket.nettogewinnUsd.map((r) => r.jahr),
    ]),
  ].sort()
  if (jahre.length < 2) return null

  const periodenIso = jahre.map((j) => `${j}-12-31`)
  const perioden: FundamentalPeriode[] = periodenIso.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, 'jahr'),
  }))

  const toMap = (reihe: { jahr: number; wertUsd: number }[]) => {
    const m = new Map<string, number>()
    for (const r of reihe) {
      const mio = zuMio(r.wertUsd)
      if (mio != null) m.set(`${r.jahr}-12-31`, mio)
    }
    return m
  }

  const zeilen: FundamentalMetrikZeile[] = [
    baueZeile(
      'bruttogewinn',
      'Bruttogewinn',
      'finanzdaten',
      'waehrung_usd_mio',
      periodenIso,
      toMap(paket.bruttogewinnUsd),
      null,
    ),
    baueZeile(
      'ebitda',
      'EBITDA',
      'finanzdaten',
      'waehrung_usd_mio',
      periodenIso,
      toMap(paket.ebitdaUsd),
      null,
    ),
    baueZeile('ebit', 'EBIT', 'finanzdaten', 'waehrung_usd_mio', periodenIso, toMap(paket.ebitUsd), null),
    baueZeile(
      'nettogewinn',
      'Nettogewinn',
      'finanzdaten',
      'waehrung_usd_mio',
      periodenIso,
      toMap(paket.nettogewinnUsd),
      null,
    ),
  ].filter((z) => Object.values(z.werte).some((v) => v != null))

  if (zeilen.length === 0) return null
  return { perioden, zeilen }
}

/** Macrotrends-GuV/Cashflow durch StockAnalysis, Yahoo & EU-URD ergänzen (alle dünnen/EU-Titel). */
export async function ergaenzeMacrotrendsMitYahooGuV(
  roh: MacrotrendsFundamentalRoh,
  symbolYahoo: string,
  opts?: { isin?: string | null; firmenname?: string | null; ticker?: string | null },
): Promise<MacrotrendsFundamentalRoh> {
  const isin = opts?.isin?.trim().toUpperCase() ?? ''
  const sym = symbolYahoo.trim().toUpperCase()
  // EU-Local + ADR parallel (kenntnisse / bekannte Paare) — nicht nur Hermès
  const yahooSymbole = yahooKennzahlenSymbolKandidaten({
    symbolYahoo: sym,
    isin: isin || null,
    macrotrendsTicker: opts?.ticker,
  }).slice(0, 3)

  const [saReihe, msChart, saStatements, ...yahooRohs] = await Promise.all([
    ladeStockanalysisGuVHistorie({
      symbolYahoo: sym,
      isin: opts?.isin,
      firmenname: opts?.firmenname,
      ticker: opts?.ticker,
    }),
    ladeMarketscreenerGuVChartPaket({
      isin: opts?.isin,
      firmenname: opts?.firmenname,
      ticker: opts?.ticker,
      symbolYahoo: sym,
    }),
    ladeStockanalysisStatementsRoh({
      symbolYahoo: sym,
      isin: opts?.isin,
      firmenname: opts?.firmenname,
      ticker: opts?.ticker,
    }),
    ...yahooSymbole.map((s) => baueYahooGuVRoh(s)),
  ])
  const yahooRoh =
    yahooRohs.find((y) => y && y.zeilen.some((z) => Object.values(z.werte).some((v) => v != null))) ??
    yahooRohs[0] ??
    null

  const urdHist =
    isin.length >= 12 && brauchtEuGuVFallback(isin)
      ? await ladeEuUrdHistorie({
          isin,
          ticker: opts?.ticker ?? sym,
          firmenname: opts?.firmenname,
        }).catch(() => null)
      : null
  const saRoh = guvRohAusStockanalysis(saReihe)
  const msRoh = guvRohAusMsChart(msChart)
  const saStRoh: YahooGuVRoh | null = saStatements
    ? { perioden: saStatements.perioden, zeilen: saStatements.zeilen }
    : null

  if (!saRoh && !yahooRoh && !urdHist && !msRoh && !saStRoh) return roh

  const saHist = saRoh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const saStHist = saStRoh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const msHist = msRoh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const yahooHist = yahooRoh?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const urdHistP = urdHist?.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm) ?? []
  const mtHist = roh.perioden.filter((p) => !p.istLtm && !p.istSchaetzung && !p.istNtm)

  const histIso = [
    ...new Set([
      ...saHist.map((p) => p.iso),
      ...saStHist.map((p) => p.iso),
      ...msHist.map((p) => p.iso),
      ...yahooHist.map((p) => p.iso),
      ...urdHistP.map((p) => p.iso),
      ...mtHist.map((p) => p.iso),
    ]),
  ].sort()

  const ttm =
    yahooRoh?.perioden.find((p) => p.istLtm) ?? roh.perioden.find((p) => p.istLtm)

  const perioden: FundamentalPeriode[] = histIso.map((iso) => {
    const hit =
      urdHistP.find((p) => p.iso === iso) ??
      saHist.find((p) => p.iso === iso) ??
      saStHist.find((p) => p.iso === iso) ??
      msHist.find((p) => p.iso === iso) ??
      yahooHist.find((p) => p.iso === iso) ??
      mtHist.find((p) => p.iso === iso)
    return hit ?? { iso, label: formatFundamentalPeriodeLabel(iso, 'jahr') }
  })
  if (ttm) perioden.push(ttm)

  const saById = new Map(saRoh?.zeilen.map((z) => [z.id, z]) ?? [])
  const saStById = new Map(saStRoh?.zeilen.map((z) => [z.id, z]) ?? [])
  const msById = new Map(msRoh?.zeilen.map((z) => [z.id, z]) ?? [])
  const yahooById = new Map(yahooRoh?.zeilen.map((z) => [z.id, z]) ?? [])
  const urdById = new Map(urdHist?.zeilen.map((z) => [z.id, z]) ?? [])
  const mergedZeilen: FundamentalMetrikZeile[] = []

  // EU/URD: Jahresbericht oft zuverlässiger als Yahoo ADR — URD zuerst
  const preferUrd = Boolean(urdHist)

  for (const z of roh.zeilen) {
    if (YAHOO_GUV_ZEILEN_IDS.has(z.id)) {
      const sz = saById.get(z.id)
      const stz = saStById.get(z.id)
      const mz = msById.get(z.id)
      const yz = yahooById.get(z.id)
      const uz = urdById.get(z.id)
      const werte: Record<string, number | null> = {}
      for (const iso of histIso) {
        werte[iso] = preferUrd
          ? pickWertFuerIso(iso, uz?.werte, sz?.werte, stz?.werte, mz?.werte, yz?.werte, z.werte)
          : pickWertFuerIso(iso, sz?.werte, stz?.werte, mz?.werte, yz?.werte, uz?.werte, z.werte)
      }
      if (ttm) {
        werte[FUNDAMENTAL_TTM_KEY] = pickWert(
          yz?.werte[FUNDAMENTAL_TTM_KEY],
          z.werte[FUNDAMENTAL_TTM_KEY],
          uz
            ? wertAusMapFuerIso(
                uz.werte,
                [...histIso].reverse().find((i) => wertAusMapFuerIso(uz.werte, i) != null) ?? '',
              )
            : null,
        )
      }
      mergedZeilen.push({ ...z, werte })
      saById.delete(z.id)
      saStById.delete(z.id)
      msById.delete(z.id)
      yahooById.delete(z.id)
      urdById.delete(z.id)
    } else {
      const werte: Record<string, number | null> = { ...z.werte }
      for (const iso of histIso) {
        const nah = wertAusMapFuerIso(z.werte, iso)
        if (nah != null) werte[iso] = nah
        else if (!(iso in werte)) werte[iso] = null
      }
      mergedZeilen.push({ ...z, werte })
    }
  }

  for (const z of [
    ...urdById.values(),
    ...saById.values(),
    ...saStById.values(),
    ...msById.values(),
    ...yahooById.values(),
  ]) {
    if (mergedZeilen.some((m) => m.id === z.id)) continue
    const werte: Record<string, number | null> = {}
    for (const iso of histIso) {
      werte[iso] = wertAusMapFuerIso(z.werte, iso)
    }
    if (ttm && z.werte[FUNDAMENTAL_TTM_KEY] != null) {
      werte[FUNDAMENTAL_TTM_KEY] = z.werte[FUNDAMENTAL_TTM_KEY]!
    }
    mergedZeilen.push({ ...z, werte })
  }

  return { ...roh, perioden, zeilen: mergedZeilen }
}

/** Fallback wenn Macrotrends leer/404 — StockAnalysis + Yahoo (EU-Portfolio). */
export async function baueFundamentalRohAusAlternativQuellen(
  ident: MacrotrendsIdent,
  symbolYahoo: string,
  opts?: { isin?: string | null; firmenname?: string | null; ticker?: string | null },
): Promise<MacrotrendsFundamentalRoh | null> {
  const shell: MacrotrendsFundamentalRoh = {
    ident,
    perioden: [],
    zeilen: [],
    beschreibung: null,
    branche: null,
  }
  const merged = await ergaenzeMacrotrendsMitYahooGuV(shell, symbolYahoo, opts)
  if (merged.zeilen.length === 0) return null
  return merged
}

/** Konzern-Umsatz pro Jahr aus Yahoo GuV — Fallback wenn Macrotrends leer (EU/ADR). */
export async function baueUmsatzProJahrAusYahoo(
  symbolYahoo: string,
): Promise<Map<number, number>> {
  const roh = await baueYahooGuVRoh(symbolYahoo.trim().toUpperCase())
  return baueUmsatzProJahrAusFinanzzeile(roh?.zeilen.find((z) => z.id === 'umsatz'))
}
