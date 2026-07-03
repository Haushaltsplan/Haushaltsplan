/** Yahoo Options Chain — ATM-Implizite Volatilität. */

import 'server-only'

import type { YahooOptionsIvPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { holeYahooFinanceAuth } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const CACHE_MS = 2 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: YahooOptionsIvPaket | null }>()

export async function ladeYahooOptionsIv(symbol: string): Promise<YahooOptionsIvPaket | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const auth = await holeYahooFinanceAuth()
  if (!auth) {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }

  try {
    const u = new URL(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}`)
    u.searchParams.set('crumb', auth.crumb)
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': YAHOO_UA, Cookie: auth.cookie, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const j = (await res.json()) as {
      optionChain?: {
        result?: Array<{
          quote?: { regularMarketPrice?: { raw?: number } }
          options?: Array<{
            expirationDate?: number
            calls?: Array<{ strike?: { raw?: number }; impliedVolatility?: { raw?: number } }>
          }>
        }>
      }
    }

    const chain = j.optionChain?.result?.[0]
    const spot = chain?.quote?.regularMarketPrice?.raw
    const opts = chain?.options?.[0]
    if (!opts?.calls?.length || spot == null) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    let best = opts.calls[0]!
    let bestDiff = Math.abs((best.strike?.raw ?? 0) - spot)
    for (const c of opts.calls) {
      const strike = c.strike?.raw
      if (strike == null) continue
      const diff = Math.abs(strike - spot)
      if (diff < bestDiff) {
        best = c
        bestDiff = diff
      }
    }

    const iv = best.impliedVolatility?.raw
    const data: YahooOptionsIvPaket = {
      impliziteVolatilitaetPct: iv != null && Number.isFinite(iv) ? Math.round(iv * 1000) / 10 : null,
      atmStrike: best.strike?.raw ?? null,
      expiration: opts.expirationDate
        ? new Date(opts.expirationDate * 1000).toISOString().slice(0, 10)
        : null,
      quelle: 'yahoo_options',
    }
    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
