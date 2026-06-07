import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  baueKeyMetrics,
  type YahooFundamentalKennzahlen,
} from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import { ladeFundamentalNews } from '@/lib/portfolio-analyse/fundamentaldaten-news-server'
import { ladeFundamentalSchaetzungen } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import {
  formatiereBrancheDe,
  ladeUnternehmensbeschreibungDe,
} from '@/lib/portfolio-analyse/fundamentaldaten-unternehmen-de'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
  macrotrendsTickerAusSymbol,
  type MacrotrendsIdent,
} from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import { holeYahooFinanceAuth } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function symboleAusAnfrage(anfrage: FundamentaldatenAnfrage): string[] {
  const out = new Set<string>()
  const add = (s?: string | null) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) out.add(t)
  }
  add(anfrage.symbolYahoo)
  for (const s of anfrage.symbolCandidates ?? []) add(s)
  const isin = anfrage.isin?.trim().toUpperCase()
  if (isin) {
    const k = isinKenntnis(isin)
    add(k?.symbolYahoo)
    for (const s of k?.symbolCandidates ?? []) add(s)
  }
  return [...out]
}

async function loeseIdent(anfrage: FundamentaldatenAnfrage): Promise<{
  ident: MacrotrendsIdent | null
  symbolYahoo: string | null
}> {
  const symbole = symboleAusAnfrage(anfrage)
  const symbolYahoo = symbole[0] ?? anfrage.symbolYahoo ?? null

  if (anfrage.tickerOverride?.trim()) {
    const t = anfrage.tickerOverride.trim().toUpperCase()
    const ident =
      (await loeseMacrotrendsIdent(t, anfrage.name)) ??
      ({ ticker: t, slug: t.toLowerCase(), firmenname: anfrage.name ?? t } satisfies MacrotrendsIdent)
    return { ident, symbolYahoo }
  }

  for (const sym of symbole) {
    const ticker = macrotrendsTickerAusSymbol(sym)
    const ident = await loeseMacrotrendsIdent(ticker, anfrage.name)
    if (ident) return { ident, symbolYahoo: sym }
  }

  if (anfrage.name?.trim()) {
    const ident = await loeseMacrotrendsIdent(anfrage.name.trim())
    if (ident) return { ident, symbolYahoo }
  }

  return { ident: null, symbolYahoo }
}

function rawNum(o: Record<string, { raw?: number }> | undefined, k: string): number | undefined {
  const v = o?.[k]?.raw
  return v != null && Number.isFinite(v) ? v : undefined
}

async function ladeYahooFundamentalKennzahlen(symbol: string): Promise<YahooFundamentalKennzahlen | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'defaultKeyStatistics,summaryDetail,assetProfile,financialData,earningsTrend')
  u.searchParams.set('crumb', auth.crumb)
  const res = await fetch(u.toString(), {
    headers: {
      'User-Agent': YAHOO_UA,
      Cookie: auth.cookie,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const j = (await res.json()) as {
    quoteSummary?: {
      result?: Array<{
        defaultKeyStatistics?: Record<string, { raw?: number }>
        summaryDetail?: Record<string, { raw?: number }>
        assetProfile?: Record<string, unknown>
        financialData?: Record<string, { raw?: number }>
        earningsTrend?: { trend?: Array<Record<string, unknown> & { period?: string }> }
      }>
    }
  }
  const row = j.quoteSummary?.result?.[0]
  if (!row) return null
  const dks = row.defaultKeyStatistics
  const sd = row.summaryDetail
  const fd = row.financialData
  const ap = row.assetProfile as Record<string, unknown> | undefined
  const fy0 = row.earningsTrend?.trend?.find((t) => t.period === '0y')
  const epsEst0 = fy0?.earningsEstimate as Record<string, unknown> | undefined
  const ntmEpsRaw = epsEst0?.avg as { raw?: number } | undefined

  return {
    fiftyTwoWeekHigh: rawNum(sd, 'fiftyTwoWeekHigh'),
    fiftyTwoWeekLow: rawNum(sd, 'fiftyTwoWeekLow'),
    beta: rawNum(dks, 'beta'),
    marketCap: rawNum(sd, 'marketCap'),
    sharesOutstanding: rawNum(dks, 'sharesOutstanding'),
    enterpriseValue: rawNum(dks, 'enterpriseValue'),
    trailingPE: rawNum(sd, 'trailingPE'),
    forwardPE: rawNum(sd, 'forwardPE'),
    dividendYield: rawNum(sd, 'dividendYield'),
    returnOnEquity: rawNum(fd, 'returnOnEquity'),
    returnOnAssets: rawNum(fd, 'returnOnAssets'),
    revenueGrowth: rawNum(fd, 'revenueGrowth'),
    earningsGrowth: rawNum(fd, 'earningsGrowth'),
    grossMargins: rawNum(fd, 'grossMargins'),
    operatingMargins: rawNum(fd, 'operatingMargins'),
    ebitdaMargins: rawNum(fd, 'ebitdaMargins'),
    profitMargins: rawNum(fd, 'profitMargins'),
    currentPrice: rawNum(sd, 'regularMarketPrice'),
    priceToBook: rawNum(dks, 'priceToBook'),
    enterpriseToRevenue: rawNum(dks, 'enterpriseToRevenue'),
    enterpriseToEbitda: rawNum(dks, 'enterpriseToEbitda'),
    totalDebt: rawNum(fd, 'totalDebt'),
    totalCash: rawNum(fd, 'totalCash'),
    ntmEpsSchaetzung: ntmEpsRaw?.raw,
    sector: typeof ap?.sector === 'string' ? ap.sector : undefined,
    industry: typeof ap?.industry === 'string' ? ap.industry : undefined,
    website: typeof ap?.website === 'string' ? ap.website : undefined,
    longBusinessSummary: typeof ap?.longBusinessSummary === 'string' ? ap.longBusinessSummary : undefined,
  } as YahooFundamentalKennzahlen & {
    sector?: string
    industry?: string
    website?: string
    longBusinessSummary?: string
  }
}

function mergePeriodenUndZeilen(
  historisch: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
  schaetzungen: { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] },
): { perioden: FundamentalPeriode[]; zeilen: FundamentalMetrikZeile[] } {
  if (schaetzungen.perioden.length === 0) return historisch

  const perioden = [...historisch.perioden, ...schaetzungen.perioden]
  const zeilen = [...historisch.zeilen]

  for (const sz of schaetzungen.zeilen) {
    const werte = { ...sz.werte }
    for (const p of historisch.perioden) {
      if (!(p.iso in werte)) werte[p.iso] = null
    }
    zeilen.push({ ...sz, werte })
  }

  for (const hz of historisch.zeilen) {
    for (const sp of schaetzungen.perioden) {
      if (!(sp.iso in hz.werte)) hz.werte[sp.iso] = null
    }
  }

  return { perioden, zeilen }
}

function leeresPaket(partial: Partial<FundamentaldatenPaket> & Pick<FundamentaldatenPaket, 'ok' | 'ticker' | 'firmenname'>): FundamentaldatenPaket {
  return {
    slug: '',
    branche: null,
    sektor: null,
    website: null,
    beschreibung: null,
    waehrung: 'USD',
    perioden: [],
    zeilen: [],
    keyMetrics: [],
    news: [],
    symbolYahoo: null,
    geladenAm: new Date().toISOString(),
    quelle: 'macrotrends',
    fehler: null,
    ...partial,
  }
}

export async function ladeFundamentaldaten(anfrage: FundamentaldatenAnfrage): Promise<FundamentaldatenPaket> {
  const { ident, symbolYahoo } = await loeseIdent(anfrage)

  if (!ident) {
    return leeresPaket({
      ok: false,
      ticker: anfrage.tickerOverride?.trim().toUpperCase() ?? '',
      firmenname: anfrage.name ?? 'Unbekannt',
      symbolYahoo,
      fehler: 'Keine Fundamentaldaten auf Macrotrends gefunden. Ticker manuell eingeben.',
    })
  }

  const [roh, yahooRaw, schaetzungen, news] = await Promise.all([
    ladeMacrotrendsFundamentaldaten(ident),
    symbolYahoo ? ladeYahooFundamentalKennzahlen(symbolYahoo) : Promise.resolve(null),
    symbolYahoo ? ladeFundamentalSchaetzungen(symbolYahoo) : Promise.resolve({ perioden: [], zeilen: [] }),
    symbolYahoo ? ladeFundamentalNews(symbolYahoo, ident.firmenname) : Promise.resolve([]),
  ])

  const yahooExt = yahooRaw as (YahooFundamentalKennzahlen & {
    sector?: string
    industry?: string
    website?: string
    longBusinessSummary?: string
  }) | null

  const brancheMeta = formatiereBrancheDe({ industry: yahooExt?.industry, sector: yahooExt?.sector })
  const beschreibungDe = await ladeUnternehmensbeschreibungDe({
    firmenname: ident.firmenname,
    ticker: ident.ticker,
    fallbackEn: yahooExt?.longBusinessSummary ?? roh?.beschreibung,
  })

  if (!roh) {
    return leeresPaket({
      ok: false,
      ticker: ident.ticker,
      slug: ident.slug,
      firmenname: ident.firmenname,
      branche: brancheMeta.branche,
      sektor: brancheMeta.sektor,
      website: yahooExt?.website ?? null,
      beschreibung: beschreibungDe,
      keyMetrics: baueKeyMetrics(yahooExt, null, schaetzungen),
      news,
      symbolYahoo,
      fehler: 'Macrotrends-Daten konnten nicht geladen werden.',
    })
  }

  const merged = mergePeriodenUndZeilen(roh, schaetzungen)

  return leeresPaket({
    ok: true,
    ticker: ident.ticker,
    slug: ident.slug,
    firmenname: ident.firmenname,
    branche: brancheMeta.branche ?? roh.branche,
    sektor: brancheMeta.sektor,
    website: yahooExt?.website ?? null,
    beschreibung: beschreibungDe,
    perioden: merged.perioden,
    zeilen: merged.zeilen,
    keyMetrics: baueKeyMetrics(yahooExt, roh, schaetzungen),
    news,
    symbolYahoo,
  })
}
