/** StockAnalysis revenue-by-segment — Fetch + Cache. */

import 'server-only'

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '@/lib/portfolio-analyse/stockanalysis-segment-parser'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 12 * 60 * 60 * 1000
const CACHE_VERSION = 1

const cache = new Map<string, { at: number; v: number; data: SecSegmentHistorie | null }>()

function saSlug(ticker: string, isin?: string | null): string {
  const k = isin ? isinKenntnis(isin) : null
  return (k?.logoSymbol ?? k?.symbolYahoo ?? ticker).trim().toLowerCase().split('.')[0]!
}

export async function ladeStockanalysisSegmentHistorie(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
  isin?: string | null
  refresh?: boolean
}): Promise<SecSegmentHistorie | null> {
  const ticker = (opts.ticker ?? opts.symbolYahoo ?? '').trim().toUpperCase().split('.')[0]
  if (!ticker) return null

  const hit = cache.get(ticker)
  if (!opts.refresh && hit && hit.v === CACHE_VERSION && Date.now() - hit.at < CACHE_MS) {
    return hit.data
  }

  const slug = saSlug(ticker, opts.isin)
  const paths = [
    `/stocks/${slug}/metrics/revenue-by-segment/`,
    `/quote/us/${ticker}/metrics/revenue-by-segment/`,
  ]

  for (const path of paths) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      })
      if (!res.ok) continue
      const data = extrahiereStockanalysisSegmentHistorieAusHtml(await res.text())
      if (data) {
        cache.set(ticker, { at: Date.now(), v: CACHE_VERSION, data })
        return data
      }
    } catch {
      /* next */
    }
  }

  return null
}
