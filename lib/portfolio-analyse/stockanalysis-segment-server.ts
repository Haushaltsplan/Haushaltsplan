/** StockAnalysis Segment & Geo — Fetch + Cache. */

import 'server-only'

import type { SecSegmentHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { saMetrikPfade } from '@/lib/portfolio-analyse/stockanalysis-metrik-pfade'
import {
  extrahiereStockanalysisOiHistorieAusHtml,
  extrahiereStockanalysisSegmentHistorieAusHtml,
} from '@/lib/portfolio-analyse/stockanalysis-segment-parser'
import { ergaenzeSegmentHistorieMitMargen } from '@/lib/portfolio-analyse/segment-margen-hilfen'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 12 * 60 * 60 * 1000
const CACHE_VERSION = 4

export type StockanalysisSegmentPaket = {
  produkt: SecSegmentHistorie | null
  geo: SecSegmentHistorie | null
}

const cache = new Map<string, { at: number; v: number; data: StockanalysisSegmentPaket | null }>()

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

async function ladeMetrik(
  paths: string[],
  art: 'produkt' | 'geo',
  ticker?: string,
): Promise<SecSegmentHistorie | null> {
  for (const path of paths) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      })
      if (!res.ok) continue
      const data = extrahiereStockanalysisSegmentHistorieAusHtml(await res.text(), art, ticker)
      if (data) return data
    } catch {
      /* next */
    }
  }
  return null
}

async function ladeOiProdukt(paths: string[], ticker?: string): Promise<SecSegmentHistorie | null> {
  for (const path of paths) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      })
      if (!res.ok) continue
      const data = extrahiereStockanalysisOiHistorieAusHtml(await res.text(), ticker)
      if (data) return data
    } catch {
      /* next */
    }
  }
  return null
}

export async function ladeStockanalysisSegmentPaket(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
  isin?: string | null
  refresh?: boolean
}): Promise<StockanalysisSegmentPaket | null> {
  if (!opts.isin && !opts.symbolYahoo && !opts.ticker) return null

  const key = cacheKey(opts)
  const hit = cache.get(key)
  if (!opts.refresh && hit && hit.v === CACHE_VERSION && Date.now() - hit.at < CACHE_MS) {
    return hit.data
  }

  const ticker = basisTicker(opts)
  const pfadOpts = { ...opts, ticker: ticker ?? opts.ticker }

  const [produktRaw, geo, produktOi] = await Promise.all([
    ladeMetrik(saMetrikPfade(pfadOpts, 'revenue-by-segment/'), 'produkt', ticker),
    ladeMetrik(saMetrikPfade(pfadOpts, 'revenue-by-geography/'), 'geo', ticker),
    ladeOiProdukt(saMetrikPfade(pfadOpts, 'operating-income-by-segment/'), ticker),
  ])

  const produkt = produktRaw
    ? ergaenzeSegmentHistorieMitMargen(produktRaw, produktOi)
    : null

  if (!produkt && !geo) return null
  const paket = { produkt, geo }
  cache.set(key, { at: Date.now(), v: CACHE_VERSION, data: paket })
  return paket
}

/** @deprecated Nutze ladeStockanalysisSegmentPaket */
export async function ladeStockanalysisSegmentHistorie(opts: {
  ticker?: string | null
  symbolYahoo?: string | null
  isin?: string | null
  refresh?: boolean
}): Promise<SecSegmentHistorie | null> {
  const paket = await ladeStockanalysisSegmentPaket(opts)
  return paket?.produkt ?? null
}
