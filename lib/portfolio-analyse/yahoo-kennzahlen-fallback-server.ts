/**
 * Yahoo-Kennzahlen mit Fallback auf Alternativ-Symbole (z. B. H11.SG → HLMA.L / HLMA).
 * Listing-Felder (Kurs, Aktien, Marktkap, 52w) bleiben atomar — kein EUR/ADR-Mix.
 * Bei Macrotrends-ADR (HESAY, SXYAY, …) hat das ADR Vorrang vor der Heimatbörse.
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

/** Kurs/Marktkap/Aktien/52w — nie über verschiedene Listings mergen. */
const LISTING_FELDER = [
  'currentPrice',
  'fiftyTwoWeekHigh',
  'fiftyTwoWeekLow',
  'marketCap',
  'sharesOutstanding',
  'floatShares',
  'impliedSharesOutstanding',
  'enterpriseValue',
  'averageVolume',
  'trailingEps',
  'trailingAnnualDividendRate',
  'targetMeanPrice',
  'currency',
  // Debt/Cash nur als Paar vom selben Listing — sonst Net-Debt-Zwitter
  'totalDebt',
  'totalCash',
] as const satisfies ReadonlyArray<keyof YahooFundamentalKennzahlen>

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
  u.searchParams.set(
    'modules',
    'defaultKeyStatistics,summaryDetail,assetProfile,financialData,earningsTrend,price',
  )
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
        price?: { currency?: string; regularMarketPrice?: { raw?: number } }
      }>
    }
  }
  const row = j.quoteSummary?.result?.[0]
  if (!row) return null

  const dks = row.defaultKeyStatistics
  const sd = row.summaryDetail
  const fd = row.financialData
  const ap = row.assetProfile as Record<string, unknown> | undefined
  const priceMod = row.price
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
  const currency =
    typeof priceMod?.currency === 'string' && priceMod.currency.trim()
      ? priceMod.currency.trim().toUpperCase()
      : undefined

  return {
    fiftyTwoWeekHigh: rawNum(sd, 'fiftyTwoWeekHigh'),
    fiftyTwoWeekLow: rawNum(sd, 'fiftyTwoWeekLow'),
    beta: rawNum(dks, 'beta'),
    marketCap: rawNum(sd, 'marketCap'),
    sharesOutstanding: rawNum(dks, 'sharesOutstanding'),
    floatShares: rawNum(dks, 'floatShares'),
    impliedSharesOutstanding: rawNum(dks, 'impliedSharesOutstanding'),
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
    currentPrice:
      priceMod?.regularMarketPrice?.raw ??
      rawNum(sd, 'regularMarketPrice') ??
      rawNum(fd, 'currentPrice'),
    currency,
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

function istListingFeld(k: keyof YahooFundamentalKennzahlen): boolean {
  return (LISTING_FELDER as readonly string[]).includes(k)
}

function mergeYahooKennzahlen(
  primary: YahooFundamentalKennzahlen | null,
  secondary: YahooFundamentalKennzahlen | null,
): YahooFundamentalKennzahlen | null {
  if (!primary) return secondary
  if (!secondary) return primary

  const out: YahooFundamentalKennzahlen = { ...primary }
  const keys = Object.keys(secondary) as (keyof YahooFundamentalKennzahlen)[]

  // Primärlisting hat bereits Kurs → Listing-Felder atomar behalten (kein EUR↔ADR-Mix).
  if (primary.currentPrice != null) {
    for (const k of keys) {
      if (istListingFeld(k)) continue
      if (out[k] == null && secondary[k] != null) {
        ;(out as Record<string, unknown>)[k] = secondary[k]
      }
    }
    return out
  }

  // Primär ohne Kurs: komplettes Listing-Bundle vom Sekundär übernehmen.
  if (secondary.currentPrice != null) {
    for (const k of LISTING_FELDER) {
      if (secondary[k] != null) {
        ;(out as Record<string, unknown>)[k] = secondary[k]
      }
    }
  }
  for (const k of keys) {
    if (istListingFeld(k)) continue
    if (out[k] == null && secondary[k] != null) {
      ;(out as Record<string, unknown>)[k] = secondary[k]
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

  const k = opts.isin ? isinKenntnis(opts.isin) : null
  const mt = (opts.macrotrendsTicker ?? k?.macrotrendsTicker)?.trim().toUpperCase() ?? null

  // ADR / Macrotrends-Ticker zuerst → Kurs in USD wie die GuV-Zeitreihen.
  add(mt)
  add(opts.symbolYahoo)
  add(k?.symbolYahoo)
  for (const s of k?.symbolCandidates ?? []) add(s)

  // Bekannte Local-Listings mit dünnen Yahoo-Daten → liquide ADR/Alternativen
  const primary = out[0] ?? ''
  const bare = primary.split('.')[0] ?? primary
  const local = (opts.symbolYahoo ?? k?.symbolYahoo ?? '').trim().toUpperCase()
  const localBare = local.split('.')[0] ?? local
  if (local === 'H11.SG' || local.startsWith('H11') || localBare === 'HLMA' || bare === 'HLMA') {
    add('HLMA.L')
    add('HLMA')
  }
  if (local === 'RMS.PA' || localBare === 'RMS' || bare === 'RMS' || bare === 'HESAY') add('HESAY')
  if (local === 'MC.PA' || localBare === 'MC' || bare === 'MC' || bare === 'LVMUY') add('LVMUY')
  if (local === 'SIKA.SW' || localBare === 'SIKA' || bare === 'SIKA' || bare === 'SXYAY') add('SXYAY')
  if (local === 'STMN.SW' || localBare === 'STMN' || bare === 'STMN' || bare === 'SAUHY') add('SAUHY')
  if (local === 'WKL.AS' || localBare === 'WKL' || bare === 'WKL' || bare === 'WTKWY') add('WTKWY')
  if (local === 'ASML.AS' || localBare === 'ASML' || bare === 'ASML') add('ASML')
  if (local === 'LIN.DE' || localBare === 'LIN' || bare === 'LIN') add('LIN')
  if (local === 'ATD.TO' || localBare === 'ATD' || bare === 'ATD') add('ANCUF')

  // Nochmals ADR an den Anfang, falls es erst über die Local-Map hinzukam.
  if (mt && out.includes(mt) && out[0] !== mt) {
    return [mt, ...out.filter((s) => s !== mt)].slice(0, 5)
  }
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
