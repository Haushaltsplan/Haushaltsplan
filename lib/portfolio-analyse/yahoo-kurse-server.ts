import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const BATCH = 20

export type YahooKursZeile = {
  preis: number | null
  /** previousClose/chartPreviousClose (gleiche Währung wie `preis`). */
  vortagPreis?: number | null
  aenderungTagProzent: number | null
}

function teileArray<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function trefferKey(map: Map<string, YahooKursZeile>, symbol: string): YahooKursZeile | undefined {
  const s = symbol.trim().toUpperCase()
  const kandidaten = [s, s.replace(/\./g, '-'), s.replace(/-/g, '.')]
  for (const k of kandidaten) {
    const hit = map.get(k)
    if (hit) return hit
  }
  if (s.includes('.')) return undefined
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
    const results = j.spark?.result ?? []
    for (const zeile of results) {
      const ySym = zeile?.symbol?.trim().toUpperCase()
      if (!ySym) continue
      const meta = zeile?.response?.[0]?.meta
      if (!meta) continue
      const preis = meta.regularMarketPrice
      const vor = meta.previousClose ?? meta.chartPreviousClose
      let pct: number | null = null
      if (preis != null && vor != null && vor !== 0) {
        pct = Math.round(((Number(preis) - Number(vor)) / Number(vor)) * 10_000) / 100
      }
      const row: YahooKursZeile = {
        preis: preis != null && Number.isFinite(Number(preis)) ? Number(preis) : null,
        vortagPreis: vor != null && Number.isFinite(Number(vor)) ? Number(vor) : null,
        aenderungTagProzent: pct,
      }
      out.set(ySym, row)
    }
  }
  return out
}

export function kursFuerSymbol(map: Map<string, YahooKursZeile>, symbol: string): YahooKursZeile | null {
  return trefferKey(map, symbol) ?? null
}

export type YahooQuoteKennzahl = {
  preis: number | null
  marktkap: number | null
  trailingPE: number | null
  priceToBook: number | null
  sektor: string | null
  industrie: string | null
}

const QUOTE_CHUNK = 80

/** Kurs, Marktkap und Trailing-KGV — derselbe Yahoo-Quote-Batch wie Depot/ETF. */
export async function ladeYahooQuoteKennzahlen(symbole: string[]): Promise<Map<string, YahooQuoteKennzahl>> {
  const uniq = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const out = new Map<string, YahooQuoteKennzahl>()
  const auth = await holeYahooFinanceAuth()
  for (const chunk of teileArray(uniq, QUOTE_CHUNK)) {
    const u = new URL('https://query1.finance.yahoo.com/v7/finance/quote')
    u.searchParams.set('symbols', chunk.join(','))
    if (auth?.crumb) u.searchParams.set('crumb', auth.crumb)
    try {
      const res = await fetch(u.toString(), {
        headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth?.cookie ?? '', ...YAHOO_FETCH_HEADERS },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const j = (await res.json()) as {
        quoteResponse?: {
          result?: Array<{
            symbol?: string
            regularMarketPrice?: number
            marketCap?: number
            trailingPE?: number
            priceToBook?: number
            sector?: string
            industry?: string
          }>
        }
      }
      for (const q of j.quoteResponse?.result ?? []) {
        const sym = q.symbol?.trim().toUpperCase()
        if (!sym) continue
        const preis = q.regularMarketPrice != null && Number.isFinite(q.regularMarketPrice) ? q.regularMarketPrice : null
        const marktkap = q.marketCap != null && Number.isFinite(q.marketCap) && q.marketCap > 0 ? q.marketCap : null
        const trailingPE =
          q.trailingPE != null && Number.isFinite(q.trailingPE) && q.trailingPE > 0 && q.trailingPE < 400
            ? q.trailingPE
            : null
        const priceToBook =
          q.priceToBook != null && Number.isFinite(q.priceToBook) && q.priceToBook > 0 ? q.priceToBook : null
        const sektor = typeof q.sector === 'string' && q.sector.trim() ? q.sector.trim() : null
        const industrie = typeof q.industry === 'string' && q.industry.trim() ? q.industry.trim() : null
        out.set(sym, { preis, marktkap, trailingPE, priceToBook, sektor, industrie })
      }
    } catch {
      /* nächster Chunk */
    }
  }
  return out
}
