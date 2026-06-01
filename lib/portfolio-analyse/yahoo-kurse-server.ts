const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const BATCH = 20

export type YahooKursZeile = {
  preis: number | null
  aenderungTagProzent: number | null
}

function teileArray<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function trefferKey(map: Map<string, YahooKursZeile>, symbol: string): YahooKursZeile | undefined {
  const kandidaten = [
    symbol.trim().toUpperCase(),
    symbol.replace(/\./g, '-').toUpperCase(),
    symbol.replace(/-/g, '.').toUpperCase(),
  ]
  for (const k of kandidaten) {
    const hit = map.get(k)
    if (hit) return hit
  }
  return undefined
}

/** Live-Kurse via Yahoo Spark (serverseitig). */
export async function ladeYahooKurse(symbole: string[]): Promise<Map<string, YahooKursZeile>> {
  const sym = [...new Set(symbole.map((s) => s.trim()).filter(Boolean))]
  const out = new Map<string, YahooKursZeile>()
  for (const batch of teileArray(sym, BATCH)) {
    const u = new URL('https://query1.finance.yahoo.com/v7/finance/spark')
    u.searchParams.set('symbols', batch.join(','))
    const res = await fetch(u.toString(), { headers: YAHOO_FETCH_HEADERS, next: { revalidate: 120 } })
    if (!res.ok) continue
    const j = (await res.json()) as {
      spark?: {
        result?: Array<{
          symbol?: string
          response?: Array<{
            meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number }
          }>
        }>
      }
    }
    for (const zeile of j.spark?.result ?? []) {
      const ySym = zeile.symbol?.trim().toUpperCase()
      const meta = zeile.response?.[0]?.meta
      if (!ySym || !meta) continue
      const preis = meta.regularMarketPrice
      const vor = meta.previousClose ?? meta.chartPreviousClose
      let pct: number | null = null
      if (preis != null && vor != null && vor !== 0) {
        pct = Math.round(((Number(preis) - Number(vor)) / Number(vor)) * 10_000) / 100
      }
      out.set(ySym, {
        preis: preis != null && Number.isFinite(Number(preis)) ? Number(preis) : null,
        aenderungTagProzent: pct,
      })
    }
  }
  return out
}

export function kursFuerSymbol(map: Map<string, YahooKursZeile>, symbol: string): YahooKursZeile | null {
  return trefferKey(map, symbol) ?? null
}
