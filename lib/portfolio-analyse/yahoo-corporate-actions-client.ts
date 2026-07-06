/**
 * Yahoo Chart API — Splits & Schlusskurse (Browser + Server).
 */

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

type YahooChartJson = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: (number | null)[] }> }
      events?: {
        splits?: Record<
          string,
          { date: number; numerator: number; denominator: number; splitRatio?: string }
        >
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

export type YahooSplitEintrag = { datum: string; faktor: number }

async function ladeYahooChart(symbol: string, events?: string): Promise<YahooChartJson['chart']> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return undefined

  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', '1d')
  u.searchParams.set('range', 'max')
  if (events) u.searchParams.set('events', events)

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const url = u.toString().replace('query1.finance.yahoo.com', host)
    try {
      const res = await fetch(url, { headers: YAHOO_HEADERS })
      if (!res.ok) continue
      const j = (await res.json()) as YahooChartJson
      if (j.chart?.result?.[0]) return j.chart
    } catch {
      /* nächster Host */
    }
  }
  return undefined
}

export async function ladeYahooSplits(symbol: string): Promise<YahooSplitEintrag[]> {
  const chart = await ladeYahooChart(symbol, 'split')
  const splits = chart?.result?.[0]?.events?.splits
  if (!splits) return []

  const out: YahooSplitEintrag[] = []
  for (const raw of Object.values(splits)) {
    const den = raw.denominator
    const num = raw.numerator
    if (!den || !num || den <= 0) continue
    const faktor = num / den
    const datum = tagAusUnix(raw.date)
    if (!datum || faktor <= 0 || Math.abs(faktor - 1) < 1e-8) continue
    out.push({ datum, faktor })
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum))
}

/** Schlusskurs am oder vor dem Datum (UTC-Tag). */
export async function yahooSchlusskursAm(symbol: string, datumIso: string): Promise<number | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym || !/^\d{4}-\d{2}-\d{2}$/.test(datumIso)) return null

  const period1 = unixTagStart(datumIso) - 14 * 86400
  const period2 = unixTagStart(datumIso) + 86400

  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
  u.searchParams.set('interval', '1d')
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const url = u.toString().replace('query1.finance.yahoo.com', host)
    try {
      const res = await fetch(url, { headers: YAHOO_HEADERS })
      if (!res.ok) continue
      const j = (await res.json()) as YahooChartJson
      const result = j.chart?.result?.[0]
      const ts = result?.timestamp
      const closes = result?.indicators?.quote?.[0]?.close
      if (!ts?.length || !closes?.length) continue

      const ziel = unixTagStart(datumIso)
      let best: number | null = null
      let bestTs = -1
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i]!
        if (t > ziel + 86400) break
        const c = closes[i]
        if (c != null && c > 0 && t <= ziel + 86400 && t >= bestTs) {
          bestTs = t
          best = c
        }
      }
      if (best != null) return Math.round(best * 10000) / 10000
    } catch {
      /* nächster Host */
    }
  }
  return null
}
