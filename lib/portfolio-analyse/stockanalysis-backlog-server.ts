/** StockAnalysis /metrics — RPO & Backlog (Fetch + Cache). */

import 'server-only'

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { extrahiereStockanalysisBacklogAusHtml } from '@/lib/portfolio-analyse/stockanalysis-backlog-parser'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 12 * 60 * 60 * 1000

const cache = new Map<string, { at: number; data: SecBacklogHistorie | null }>()

function saSlug(ticker: string, isin?: string | null): string {
  const k = isin ? isinKenntnis(isin) : null
  return (k?.logoSymbol ?? k?.symbolYahoo ?? ticker).trim().toLowerCase().split('.')[0]!
}

export async function ladeStockanalysisBacklogHistorie(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
  isin?: string | null
}): Promise<SecBacklogHistorie | null> {
  const ticker = (opts.ticker ?? opts.symbolYahoo ?? '').trim().toUpperCase().split('.')[0]
  if (!ticker) return null

  const hit = cache.get(ticker)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const slug = saSlug(ticker, opts.isin)
  const paths = [`/stocks/${slug}/metrics/`, `/quote/us/${ticker}/metrics/`]

  for (const path of paths) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      })
      if (!res.ok) continue
      const data = extrahiereStockanalysisBacklogAusHtml(await res.text())
      if (data) {
        cache.set(ticker, { at: Date.now(), data })
        return data
      }
    } catch {
      /* next */
    }
  }

  cache.set(ticker, { at: Date.now(), data: null })
  return null
}
