import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import { reichereHoldingsMitSektor } from '@/lib/portfolio-analyse/etf-scraper/yahoo-sector-enrichment-server'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const NASDAQ100_URL = 'https://stockanalysis.com/list/nasdaq-100-stocks/'

const CACHE_MS = 24 * 60 * 60 * 1000
let symbolCache: { at: number; symbols: string[] } | null = null

async function ladeNasdaq100Symbole(): Promise<string[]> {
  if (symbolCache && Date.now() - symbolCache.at < CACHE_MS) return symbolCache.symbols

  const res = await fetch(NASDAQ100_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeinHaushalt/1.0)', 'Accept-Language': 'en-US' },
    cache: 'no-store',
  })
  if (!res.ok) return symbolCache?.symbols ?? []

  const html = await res.text()
  const symbols = [
    ...new Set(
      [...html.matchAll(/<a href="\/stocks\/([a-z0-9.-]+)\/">([A-Z0-9.-]+)<\/a>/g)]
        .filter((m) => m[1] === m[2].toLowerCase())
        .map((m) => m[2].toUpperCase()),
    ),
  ]

  if (symbols.length >= 95) symbolCache = { at: Date.now(), symbols }
  return symbols
}

async function yahooMarketCaps(symbols: string[]): Promise<{
  caps: Map<string, number>
  names: Map<string, string>
}> {
  const auth = await holeYahooFinanceAuth()
  const caps = new Map<string, number>()
  const names = new Map<string, string>()
  const chunkSize = 80

  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize)
    const u = new URL('https://query1.finance.yahoo.com/v7/finance/quote')
    u.searchParams.set('symbols', chunk.join(','))
    if (auth?.crumb) u.searchParams.set('crumb', auth.crumb)

    try {
      const res = await fetch(u.toString(), {
        headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth?.cookie ?? '' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const j = (await res.json()) as {
        quoteResponse?: { result?: Array<{ symbol?: string; marketCap?: number; shortName?: string }> }
      }
      for (const q of j.quoteResponse?.result ?? []) {
        const sym = q.symbol?.trim().toUpperCase()
        if (sym && q.marketCap != null && q.marketCap > 0) {
          caps.set(sym, q.marketCap)
          if (q.shortName?.trim()) names.set(sym, q.shortName.trim())
        }
      }
    } catch {
      /* nächster Chunk */
    }
  }

  return { caps, names }
}

/** Nasdaq-100 vollständig (Symbole + Marktkapitalisierung als Gewicht). */
export async function ladeNasdaq100Breakdown(): Promise<EtfBreakdown | null> {
  const symbols = await ladeNasdaq100Symbole()
  if (symbols.length < 95) return null

  const { caps, names } = await yahooMarketCaps(symbols)
  if (caps.size < 80) return null

  let total = 0
  for (const sym of symbols) total += caps.get(sym) ?? 0
  if (total <= 0) return null

  const topHoldings = symbols
    .map((sym) => {
      const cap = caps.get(sym)
      if (cap == null || cap <= 0) return null
      const name = names.get(sym) ?? sym
      return {
        name,
        symbol: sym,
        percentage: (cap / total) * 100,
      }
    })
    .filter((x): x is { name: string; symbol: string; percentage: number } => x != null)
    .sort((a, b) => b.percentage - a.percentage)

  if (topHoldings.length < 80) return null

  const enriched = await reichereHoldingsMitSektor(topHoldings, 120)

  return { topHoldings: enriched, sectors: [], countries: [] }
}
