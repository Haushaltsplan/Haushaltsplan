import 'server-only'

import { isinAusYahooSymbol } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { lookupIsinMetadaten, type IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

export type AktienSuchTreffer = {
  symbol: string
  name: string
  exchange: string | null
  sector: string | null
}

type YahooQuote = {
  symbol?: string
  longname?: string
  shortname?: string
  quoteType?: string
  exchange?: string
  sector?: string
}

function istAktienQuote(q: YahooQuote): boolean {
  const typ = (q.quoteType ?? '').toUpperCase()
  if (typ !== 'EQUITY') return false
  const sym = q.symbol?.trim()
  if (!sym) return false
  if (sym.includes('=')) return false
  return true
}

function nameAusQuote(q: YahooQuote): string {
  return (q.longname ?? q.shortname ?? q.symbol ?? '').trim()
}

/** Yahoo Finance — Name, Ticker oder ISIN. */
export async function sucheAktien(query: string): Promise<AktienSuchTreffer[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const u = new URL('https://query1.finance.yahoo.com/v1/finance/search')
  u.searchParams.set('q', q)
  u.searchParams.set('quotesCount', '14')
  u.searchParams.set('newsCount', '0')

  const res = await fetch(u.toString(), { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) return []

  const j = (await res.json()) as { quotes?: YahooQuote[] }
  const seen = new Set<string>()
  const out: AktienSuchTreffer[] = []

  for (const quote of j.quotes ?? []) {
    if (!istAktienQuote(quote)) continue
    const symbol = quote.symbol!.trim()
    const key = symbol.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    const name = nameAusQuote(quote)
    if (!name) continue
    out.push({
      symbol,
      name,
      exchange: quote.exchange?.trim() ?? null,
      sector: quote.sector?.trim() ?? null,
    })
    if (out.length >= 10) break
  }

  return out
}

async function finnhubIsinFuerSymbol(symbol: string): Promise<string | null> {
  const key = (process.env.FINNHUB_API_KEY ?? '').trim()
  if (!key) return null

  const kandidaten = [symbol.trim(), symbol.split('.')[0]?.trim()].filter(Boolean) as string[]
  const uniq = [...new Set(kandidaten.map((s) => s.toUpperCase()))]

  for (const sym of uniq) {
    const u = new URL('https://finnhub.io/api/v1/stock/profile2')
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)
    try {
      const res = await fetch(u.toString(), { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const j = (await res.json()) as { isin?: string }
      const isin = j.isin?.trim().toUpperCase()
      if (isin && ISIN_RE.test(isin)) return isin
    } catch {
      /* nächster Kandidat */
    }
  }
  return null
}

/** Metadaten für Watchlist / Fundamentaldaten (ISIN wenn auflösbar). */
export async function loeseAktieAusSuche(
  symbol: string,
  name?: string,
): Promise<{ meta: IsinMetadata; isin: string | null } | null> {
  const sym = symbol.trim()
  if (!sym) return null

  const isinViaFinnhub = await finnhubIsinFuerSymbol(sym)
  if (isinViaFinnhub) {
    const [meta] = await lookupIsinMetadaten([isinViaFinnhub])
    if (meta?.symbolYahoo || meta?.name) {
      return { meta, isin: isinViaFinnhub }
    }
  }

  const isinViaKenntnis = isinAusYahooSymbol(sym)
  if (isinViaKenntnis) {
    const [meta] = await lookupIsinMetadaten([isinViaKenntnis])
    if (meta) return { meta, isin: isinViaKenntnis }
  }

  const meta: IsinMetadata = {
    isin: isinViaFinnhub ?? sym.toUpperCase(),
    name: name?.trim() || sym,
    symbolYahoo: sym,
    symbolCandidates: [sym],
    wkn: null,
    assetType: 'Equity',
  }

  return { meta, isin: isinViaFinnhub }
}

export function istGueltigeIsinEingabe(s: string): boolean {
  return ISIN_RE.test(s.trim().toUpperCase())
}
