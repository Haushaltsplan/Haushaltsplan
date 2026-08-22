/**
 * Yahoo-Kennzahlen mit Fallback auf Alternativ-Symbole (z. B. H11.SG → HLMA.L / HLMA).
 * Füllt nur fehlende Felder — Primärsymbol bleibt Kurs-/FX-Anker.
 */

import 'server-only'

import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function rawNum(o: Record<string, { raw?: number }> | undefined, k: string): number | undefined {
  const v = o?.[k]?.raw
  return v != null && Number.isFinite(v) ? v : undefined
}

async function ladeYahooQuoteSummaryEinmal(
  symbol: string,
): Promise<(YahooFundamentalKennzahlen & { sector?: string; industry?: string; website?: string; longBusinessSummary?: string }) | null> {
  const auth = await holeYahooFinanceAuth()
  if (!auth) return null

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  u.searchParams.set('modules', 'defaultKeyStatistics,summaryDetail,assetProfile,financialData,earningsTrend')
  u.searchParams.set('crumb', auth.crumb)

  const res = await fetch(u.toString(), {
    headers: {
      ...YAHOO_FINANCE_FETCH_HEADERS,
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
  const fy1 = row.earningsTrend?.trend?.find((t) => t.period === '+1y')
  const epsEst0 = fy0?.earningsEstimate as Record<string, unknown> | undefined
  const revEst0 = fy0?.revenueEstimate as Record<string, unknown> | undefined
  const revEst1 = fy1?.revenueEstimate as Record<string, unknown> | undefined
  const ebitdaEst0 = fy0?.ebitdaEstimate as Record<string, unknown> | undefined
  const ebitdaEst1 = fy1?.ebitdaEstimate as Record<string, unknown> | undefined
  const epsEst1 = fy1?.earningsEstimate as Record<string, unknown> | undefined
  const rawObj = (o: Record<string, unknown> | undefined, k: string) => {
    const v = o?.[k] as { raw?: number } | undefined
    return v?.raw != null && Number.isFinite(v.raw) ? v.raw : undefined
  }

  return {
    fiftyTwoWeekHigh: rawNum(sd, 'fiftyTwoWeekHigh'),
    fiftyTwoWeekLow: rawNum(sd, 'fiftyTwoWeekLow'),
    beta: rawNum(dks, 'beta'),
    marketCap: rawNum(sd, 'marketCap'),
    sharesOutstanding: rawNum(dks, 'sharesOutstanding'),
    floatShares: rawNum(dks, 'floatShares'),
    enterpriseValue: rawNum(dks, 'enterpriseValue'),
    trailingPE: rawNum(sd, 'trailingPE'),
    forwardPE: rawNum(sd, 'forwardPE'),
    dividendYield: rawNum(sd, 'dividendYield'),
    payoutRatio: rawNum(dks, 'payoutRatio') ?? rawNum(sd, 'payoutRatio'),
    trailingEps: rawNum(sd, 'trailingEps') ?? rawNum(dks, 'trailingEps'),
    trailingAnnualDividendRate:
      rawNum(sd, 'trailingAnnualDividendRate') ?? rawNum(dks, 'trailingAnnualDividendRate'),
    returnOnEquity: rawNum(fd, 'returnOnEquity'),
    returnOnAssets: rawNum(fd, 'returnOnAssets'),
    revenueGrowth: rawNum(fd, 'revenueGrowth'),
    earningsGrowth: rawNum(fd, 'earningsGrowth'),
    grossMargins: rawNum(fd, 'grossMargins'),
    operatingMargins: rawNum(fd, 'operatingMargins'),
    ebitdaMargins: rawNum(fd, 'ebitdaMargins'),
    currentPrice: rawNum(sd, 'regularMarketPrice') ?? rawNum(fd, 'currentPrice'),
    targetMeanPrice: rawNum(fd, 'targetMeanPrice'),
    priceToBook: rawNum(dks, 'priceToBook'),
    enterpriseToRevenue: rawNum(dks, 'enterpriseToRevenue'),
    enterpriseToEbitda: rawNum(dks, 'enterpriseToEbitda'),
    totalDebt: rawNum(fd, 'totalDebt'),
    totalCash: rawNum(fd, 'totalCash'),
    averageVolume: rawNum(sd, 'averageDailyVolume3Month') ?? rawNum(sd, 'averageVolume10days'),
    ntmEpsSchaetzung: rawObj(epsEst0, 'avg'),
    ntmRevenueUsd: rawObj(revEst0, 'avg'),
    ntmEbitdaUsd: rawObj(ebitdaEst0, 'avg'),
    fy1RevenueUsd: rawObj(revEst1, 'avg'),
    fy1EbitdaUsd: rawObj(ebitdaEst1, 'avg'),
    fy1Eps: rawObj(epsEst1, 'avg'),
    sector: typeof ap?.sector === 'string' ? ap.sector : undefined,
    industry: typeof ap?.industry === 'string' ? ap.industry : undefined,
    website: typeof ap?.website === 'string' ? ap.website : undefined,
    longBusinessSummary: typeof ap?.longBusinessSummary === 'string' ? ap.longBusinessSummary : undefined,
  }
}

function fehlendeKernfelder(y: YahooFundamentalKennzahlen | null): boolean {
  if (!y) return true
  return (
    y.forwardPE == null ||
    y.fiftyTwoWeekHigh == null ||
    y.currentPrice == null ||
    (y.fy1Eps == null && y.ntmEpsSchaetzung == null)
  )
}

function mergeYahooKennzahlen(
  primary: YahooFundamentalKennzahlen | null,
  secondary: YahooFundamentalKennzahlen | null,
): YahooFundamentalKennzahlen | null {
  if (!primary) return secondary
  if (!secondary) return primary

  const out: YahooFundamentalKennzahlen = { ...primary }
  const keys = Object.keys(secondary) as (keyof YahooFundamentalKennzahlen)[]
  for (const k of keys) {
    if (out[k] == null && secondary[k] != null) {
      ;(out as Record<string, unknown>)[k] = secondary[k]
    }
  }

  // Drawdown: 52w-Hoch und Kurs müssen gleiche Währung/Listing sein.
  // Wenn Primärkurs da ist aber 52w fehlt → 52w vom Sekundär nur nutzen, wenn Primärpreis fehlt
  // oder Sekundär-Preis ≈ Primär (gleiche Währung, ±15%).
  if (
    primary.currentPrice != null &&
    primary.fiftyTwoWeekHigh == null &&
    secondary.fiftyTwoWeekHigh != null &&
    secondary.currentPrice != null
  ) {
    const ratio = secondary.currentPrice / primary.currentPrice
    if (ratio > 0.85 && ratio < 1.15) {
      out.fiftyTwoWeekHigh = secondary.fiftyTwoWeekHigh
      out.fiftyTwoWeekLow = out.fiftyTwoWeekLow ?? secondary.fiftyTwoWeekLow
    } else {
      // Unterschiedliche Währung: Drawdown über Sekundär-Listing berechnen
      out.fiftyTwoWeekHigh = secondary.fiftyTwoWeekHigh
      out.fiftyTwoWeekLow = secondary.fiftyTwoWeekLow ?? out.fiftyTwoWeekLow
      out.currentPrice = secondary.currentPrice
    }
  }

  return out
}

/** Symbole die für Kennzahlen (nicht Depot-Kurs) versucht werden. */
export function yahooKennzahlenSymbolKandidaten(opts: {
  symbolYahoo?: string | null
  isin?: string | null
  macrotrendsTicker?: string | null
}): string[] {
  const out: string[] = []
  const add = (s?: string | null) => {
    const t = s?.trim().toUpperCase()
    if (t && !out.includes(t)) out.push(t)
  }

  add(opts.symbolYahoo)
  const k = opts.isin ? isinKenntnis(opts.isin) : null
  add(k?.symbolYahoo)
  for (const s of k?.symbolCandidates ?? []) add(s)
  add(k?.macrotrendsTicker)
  add(opts.macrotrendsTicker)

  // Bekannte EU/UK-Listings mit dünnen Yahoo-Daten → liquide Alternativen
  const primary = out[0] ?? ''
  if (primary === 'H11.SG' || primary.startsWith('H11')) {
    add('HLMA.L')
    add('HLMA')
  }
  if (primary === 'RMS.PA') add('HESAY')
  if (primary === 'SIKA.SW') add('SXYAY')
  if (primary === 'STMN.SW') add('SAUHY')
  if (primary === 'ATD.TO') add('ANCUF')

  return out.slice(0, 5)
}

/** Lädt Yahoo-Kennzahlen und füllt Lücken über Alternativ-Symbole. */
export async function ladeYahooFundamentalKennzahlenMitFallback(opts: {
  symbolYahoo: string
  isin?: string | null
  macrotrendsTicker?: string | null
}): Promise<(YahooFundamentalKennzahlen & {
  sector?: string
  industry?: string
  website?: string
  longBusinessSummary?: string
}) | null> {
  const kandidaten = yahooKennzahlenSymbolKandidaten(opts)
  let merged: YahooFundamentalKennzahlen | null = null

  for (const sym of kandidaten) {
    const hit = await ladeYahooQuoteSummaryEinmal(sym)
    if (!hit) continue
    merged = mergeYahooKennzahlen(merged, hit)
    if (!fehlendeKernfelder(merged)) break
  }

  return merged as
    | (YahooFundamentalKennzahlen & {
        sector?: string
        industry?: string
        website?: string
        longBusinessSummary?: string
      })
    | null
}
