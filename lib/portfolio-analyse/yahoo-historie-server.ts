import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'

const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const BATCH_PARALLEL = 6

function monatAusUnix(sec: number): string | null {
  if (!Number.isFinite(sec) || sec <= 0) return null
  const d = new Date(sec * 1000)
  if (!Number.isFinite(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function unixMonatsStart(monat: string): number {
  const [y, m] = monat.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, 1) / 1000)
}

function unixMonatsEnde(monat: string): number {
  const [y, m] = monat.split('-').map(Number)
  return Math.floor(Date.UTC(y, m, 0, 23, 59, 59) / 1000)
}

/** Monatliche Schlusskurse (Rohwährung der Börse) via Yahoo Chart API. */
export async function ladeYahooHistorieMonatlich(
  symbol: string,
  vonMonat: string,
  bisMonat: string,
): Promise<Map<string, number>> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return new Map()

  const period1 = unixMonatsStart(vonMonat)
  const period2 = unixMonatsEnde(bisMonat)
  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', '1mo')
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))

  try {
    const res = await fetch(u.toString(), {
      headers: YAHOO_FETCH_HEADERS,
      next: { revalidate: 3600 },
    })
    if (!res.ok) return new Map()
    const j = (await res.json()) as {
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
    const result = j.chart?.result?.[0]
    if (!result?.timestamp?.length) return new Map()

    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      []
    const out = new Map<string, number>()
    for (let i = 0; i < result.timestamp.length; i++) {
      const k = monatAusUnix(result.timestamp[i])
      const c = closes[i]
      if (!k || c == null || !Number.isFinite(c) || c <= 0) continue
      out.set(k, Math.round(c * 10000) / 10000)
    }
    return out
  } catch {
    return new Map()
  }
}

export async function ladeYahooHistorieBatch(
  symbols: string[],
  vonMonat: string,
  bisMonat: string,
): Promise<Map<string, Map<string, number>>> {
  const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !s.startsWith('STOOQ:'),
  )
  const out = new Map<string, Map<string, number>>()

  for (const batch of teileArray(uniq, BATCH_PARALLEL)) {
    await Promise.all(
      batch.map(async (sym) => {
        const serie = await ladeYahooHistorieMonatlich(sym, vonMonat, bisMonat)
        if (serie.size > 0) out.set(sym, serie)
      }),
    )
  }
  return out
}
