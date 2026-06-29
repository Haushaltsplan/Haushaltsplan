import 'server-only'

import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import type { MomentumBarDaily } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const BATCH_PARALLEL = 4
const YAHOO_CHUNK_TAGE = 730

type YahooChartJson = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: (number | null)[]
          high?: (number | null)[]
          low?: (number | null)[]
          close?: (number | null)[]
          volume?: (number | null)[]
        }>
        adjclose?: Array<{ adjclose?: (number | null)[] }>
      }
    }>
  }
}

function tagAusUnix(sec: number): string | null {
  if (!Number.isFinite(sec) || sec <= 0) return null
  const d = new Date(sec * 1000)
  if (!Number.isFinite(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function unixTagStart(tag: string): number {
  const [y, m, d] = tag.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 1000)
}

function unixTagEnde(tag: string): number {
  return unixTagStart(tag) + 86400 - 1
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function datumChunks(vonIso: string, bisIso: string, maxTage: number): { von: string; bis: string }[] {
  const alle: string[] = []
  const [y0, m0, d0] = vonIso.split('-').map(Number)
  const [y1, m1, d1] = bisIso.split('-').map(Number)
  const cur = new Date(y0, m0 - 1, d0)
  const end = new Date(y1, m1 - 1, d1)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    alle.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  if (alle.length <= maxTage) return [{ von: vonIso, bis: bisIso }]
  const chunks: { von: string; bis: string }[] = []
  for (let i = 0; i < alle.length; i += maxTage) {
    const slice = alle.slice(i, i + maxTage)
    chunks.push({ von: slice[0], bis: slice[slice.length - 1] })
  }
  return chunks
}

async function ladeYahooOhlcvChunk(
  symbol: string,
  vonDatum: string,
  bisDatum: string,
): Promise<MomentumBarDaily[]> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return []

  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', '1d')
  u.searchParams.set('period1', String(unixTagStart(vonDatum)))
  u.searchParams.set('period2', String(unixTagEnde(bisDatum)))

  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

  for (const host of hosts) {
    const url = u.toString().replace('query1.finance.yahoo.com', host)
    try {
      const res = await fetch(url, {
        headers: YAHOO_FETCH_HEADERS,
        next: { revalidate: 1800 },
      })
      if (!res.ok) continue
      const j = (await res.json()) as YahooChartJson
      const result = j.chart?.result?.[0]
      if (!result?.timestamp?.length) continue

      const quote = result.indicators?.quote?.[0]
      const adj = result.indicators?.adjclose?.[0]?.adjclose ?? []
      if (!quote) continue

      const bars: MomentumBarDaily[] = []
      for (let i = 0; i < result.timestamp.length; i++) {
        const tag = tagAusUnix(result.timestamp[i])
        const o = quote.open?.[i]
        const h = quote.high?.[i]
        const l = quote.low?.[i]
        const c = quote.close?.[i]
        const v = quote.volume?.[i]
        const ac = adj[i]
        if (!tag || o == null || h == null || l == null || c == null) continue
        if (![o, h, l, c].every((x) => Number.isFinite(x) && x > 0)) continue
        bars.push({
          symbol: sym,
          handelstag: tag,
          open: runde4(Number(o)),
          high: runde4(Number(h)),
          low: runde4(Number(l)),
          close: runde4(Number(c)),
          adjClose: ac != null && Number.isFinite(ac) && ac > 0 ? runde4(Number(ac)) : null,
          volume: v != null && Number.isFinite(v) ? Math.round(Number(v)) : 0,
        })
      }
      return bars
    } catch {
      continue
    }
  }
  return []
}

/** Tägliche OHLCV-Kerzen für ein Symbol (Yahoo Chart API). */
export async function ladeYahooOhlcvTaeglich(
  symbol: string,
  vonDatum: string,
  bisDatum: string,
): Promise<MomentumBarDaily[]> {
  const merged = new Map<string, MomentumBarDaily>()
  for (const chunk of datumChunks(vonDatum, bisDatum, YAHOO_CHUNK_TAGE)) {
    const part = await ladeYahooOhlcvChunk(symbol, chunk.von, chunk.bis)
    for (const bar of part) merged.set(bar.handelstag, bar)
  }
  return [...merged.values()].sort((a, b) => a.handelstag.localeCompare(b.handelstag))
}

/** Batch: tägliche OHLCV für mehrere Symbole. */
export async function ladeYahooOhlcvBatch(
  symbols: string[],
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, MomentumBarDaily[]>> {
  const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !s.startsWith('STOOQ:'),
  )
  const out = new Map<string, MomentumBarDaily[]>()

  for (const batch of teileArray(uniq, BATCH_PARALLEL)) {
    await Promise.all(
      batch.map(async (sym) => {
        const bars = await ladeYahooOhlcvTaeglich(sym, vonDatum, bisDatum)
        if (bars.length > 0) out.set(sym, bars)
      }),
    )
  }
  return out
}
