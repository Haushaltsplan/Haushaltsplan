import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'

const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const BATCH_PARALLEL = 6

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

type YahooChartJson = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>
        adjclose?: Array<{ adjclose?: (number | null)[] }>
      }
    }>
  }
}

async function ladeYahooChartSerie(
  symbol: string,
  interval: '1d' | '1mo',
  period1: number,
  period2: number,
  keyFn: (sec: number) => string | null,
): Promise<Map<string, number>> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return new Map()

  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', interval)
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))

  try {
    const res = await fetch(u.toString(), {
      headers: YAHOO_FETCH_HEADERS,
      next: { revalidate: interval === '1d' ? 1800 : 3600 },
    })
    if (!res.ok) return new Map()
    const j = (await res.json()) as YahooChartJson
    const result = j.chart?.result?.[0]
    if (!result?.timestamp?.length) return new Map()

    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      []
    const out = new Map<string, number>()
    for (let i = 0; i < result.timestamp.length; i++) {
      const k = keyFn(result.timestamp[i])
      const c = closes[i]
      if (!k || c == null || !Number.isFinite(c) || c <= 0) continue
      out.set(k, Math.round(c * 10000) / 10000)
    }
    return out
  } catch {
    return new Map()
  }
}

const YAHOO_CHUNK_TAGE = 730

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

/** Tägliche Schlusskurse (Rohwährung) via Yahoo Chart API — in Zeitfenstern (Truncation-Schutz). */
export async function ladeYahooHistorieTaeglich(
  symbol: string,
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, number>> {
  const merged = new Map<string, number>()
  for (const chunk of datumChunks(vonDatum, bisDatum, YAHOO_CHUNK_TAGE)) {
    const part = await ladeYahooChartSerie(
      symbol,
      '1d',
      unixTagStart(chunk.von),
      unixTagEnde(chunk.bis),
      tagAusUnix,
    )
    for (const [tag, kurs] of part) merged.set(tag, kurs)
  }
  return merged
}

export async function ladeYahooHistorieBatchTaeglich(
  symbols: string[],
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, Map<string, number>>> {
  const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !s.startsWith('STOOQ:'),
  )
  const out = new Map<string, Map<string, number>>()

  for (const batch of teileArray(uniq, BATCH_PARALLEL)) {
    await Promise.all(
      batch.map(async (sym) => {
        const serie = await ladeYahooHistorieTaeglich(sym, vonDatum, bisDatum)
        if (serie.size > 0) out.set(sym, serie)
      }),
    )
  }
  return out
}
