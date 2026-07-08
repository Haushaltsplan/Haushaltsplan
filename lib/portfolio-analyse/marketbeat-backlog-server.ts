/** MarketBeat financials — Backlog / Deferred Revenue (Fetch + Cache). */

import 'server-only'

import type { SecBacklogHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { extrahiereMarketbeatBacklogAusHtml } from '@/lib/portfolio-analyse/marketbeat-backlog-parser'

const BASE = 'https://www.marketbeat.com/stocks'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 12 * 60 * 60 * 1000

const cache = new Map<string, { at: number; data: SecBacklogHistorie | null }>()

async function fetchFinancialsHtml(exchange: string, ticker: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/${exchange}/${ticker}/financials/`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 50_000 ? html : null
  } catch {
    return null
  }
}

/** US-Ticker — probiert NASDAQ, NYSE, AMEX. */
export async function ladeMarketbeatBacklogHistorie(ticker: string): Promise<SecBacklogHistorie | null> {
  const sym = ticker.trim().toUpperCase().split('.')[0]!
  if (!sym || sym.length > 6) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  for (const exchange of ['NASDAQ', 'NYSE', 'AMEX'] as const) {
    const html = await fetchFinancialsHtml(exchange, sym)
    if (!html) continue
    const data = extrahiereMarketbeatBacklogAusHtml(html)
    if (data) {
      cache.set(sym, { at: Date.now(), data })
      return data
    }
  }

  cache.set(sym, { at: Date.now(), data: null })
  return null
}
