/** StockAnalysis /metrics — RPO & Backlog (Fetch + Cache). */

import 'server-only'

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { extrahiereStockanalysisBacklogAusHtml } from '@/lib/portfolio-analyse/stockanalysis-backlog-parser'
import { saMetricsHauptPfade } from '@/lib/portfolio-analyse/stockanalysis-metrik-pfade'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 12 * 60 * 60 * 1000
const CACHE_VERSION = 3

const cache = new Map<string, { at: number; v: number; data: SecBacklogHistorie | null }>()

function cacheKey(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
  isin?: string | null
}): string {
  return [opts.isin, opts.symbolYahoo, opts.ticker].map((s) => s?.trim().toUpperCase() ?? '').join('|')
}

function basisTicker(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
}): string | undefined {
  for (const sym of [opts.ticker, opts.symbolYahoo]) {
    const t = sym?.trim().toUpperCase()
    if (t) return t.split('.')[0]
  }
  return undefined
}

export async function ladeStockanalysisBacklogHistorie(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
  isin?: string | null
  refresh?: boolean
}): Promise<SecBacklogHistorie | null> {
  if (!opts.isin && !opts.symbolYahoo && !opts.ticker) return null

  const key = cacheKey(opts)
  const hit = cache.get(key)
  if (!opts.refresh && hit && hit.v === CACHE_VERSION && Date.now() - hit.at < CACHE_MS) return hit.data

  const ticker = basisTicker(opts)
  const paths = saMetricsHauptPfade({ ...opts, ticker: ticker ?? opts.ticker })

  for (const path of paths) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      })
      if (!res.ok) continue
      const data = extrahiereStockanalysisBacklogAusHtml(await res.text(), ticker)
      if (data) {
        cache.set(key, { at: Date.now(), v: CACHE_VERSION, data })
        return data
      }
    } catch {
      /* next */
    }
  }

  cache.set(key, { at: Date.now(), v: CACHE_VERSION, data: null })
  return null
}
