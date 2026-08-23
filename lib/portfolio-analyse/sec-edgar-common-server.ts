/** SEC EDGAR — gemeinsame Hilfsfunktionen (CIK, Fetch, URLs). */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'

let tickerCikCache: Map<string, number> | null = null
let tickerCikLoadedAt = 0
const TICKER_CACHE_MS = 24 * 60 * 60 * 1000

export function secUserAgent(): string {
  const custom =
    process.env.SEC_EDGAR_USER_AGENT?.trim() || process.env.EDGAR_USER_AGENT?.trim()
  if (custom) return custom
  const email = (process.env.APP_ALLOWED_EMAILS || 'contact@example.com').split(/[,;\s]+/)[0]?.trim()
  return `Omnia Haushalt ${email || 'contact@example.com'}`
}

/** CIK aus Accession-Nummer (kann Filing-Agent sein, nicht immer Company-CIK). */
export function cikAusAccession(accession: string): number {
  return parseInt(accession.split('-')[0]!, 10)
}

export function normalisiereUsTicker(ticker: string): string[] {
  const t = ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  if (!t) return []
  const variants = [t]
  if (t.includes('.')) variants.push(t.split('.')[0]!)
  if (t === 'GOOG') variants.push('GOOGL')
  if (t === 'GOOGL') variants.push('GOOG')
  return [...new Set(variants.filter(Boolean))]
}

export function padCik(cik: number): string {
  return String(cik).padStart(10, '0')
}

export function dokumentUrl(cik: number, accession: string, dateiname: string): string {
  if (/^https?:\/\//i.test(dateiname)) return dateiname
  const accPath = accession.replace(/-/g, '')
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${dateiname}`
}

export async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': secUserAgent(), Accept: 'application/json, text/html, application/xml, */*' },
    cache: 'no-store',
  })
}

async function ladeTickerCikMap(): Promise<Map<string, number>> {
  if (tickerCikCache && Date.now() - tickerCikLoadedAt < TICKER_CACHE_MS) return tickerCikCache
  const res = await secFetch('https://www.sec.gov/files/company_tickers.json')
  if (!res.ok) {
    // Rate-Limit (429) oder SEC-Ausfall — veralteten Cache weiter nutzen statt alles zu blockieren
    if (tickerCikCache && (res.status === 429 || res.status === 503 || res.status >= 500)) {
      console.warn(
        `[sec-edgar] Ticker-Liste HTTP ${res.status} — nutze veralteten Cache (${tickerCikCache.size} Ticker).`,
      )
      return tickerCikCache
    }
    throw new Error(`SEC Ticker-Liste (${res.status})`)
  }
  const raw = await leseAlsJson<Record<string, { cik_str?: number | string; ticker?: string }>>(res)
  const map = new Map<string, number>()
  for (const row of Object.values(raw ?? {})) {
    if (!row.ticker || row.cik_str == null || row.cik_str === '') continue
    const cik = Number(row.cik_str)
    if (!Number.isFinite(cik) || cik <= 0) continue
    map.set(row.ticker.toUpperCase(), cik)
  }
  tickerCikCache = map
  tickerCikLoadedAt = Date.now()
  return map
}

export async function cikFuerTicker(ticker: string): Promise<number | null> {
  try {
    const map = await ladeTickerCikMap()
    for (const variant of normalisiereUsTicker(ticker)) {
      const hit = map.get(variant)
      if (hit) return hit
    }
    return null
  } catch (e) {
    console.warn('[sec-edgar] cikFuerTicker fehlgeschlagen:', e instanceof Error ? e.message : e)
    return null
  }
}

export type SecSubmissionsRecent = {
  accessionNumber?: string[]
  form?: string[]
  filingDate?: string[]
  primaryDocument?: string[]
  reportDate?: string[]
  /** z. B. "2.02,9.01" bei 8-K */
  items?: string[]
}

export async function ladeSecSubmissionsRecent(cik: number): Promise<SecSubmissionsRecent | null> {
  const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
  if (!subRes.ok) return null
  const sub = await leseAlsJson<{ filings?: { recent?: SecSubmissionsRecent } }>(subRes)
  return sub?.filings?.recent ?? null
}

export function istUsBoersenTicker(ticker: string): boolean {
  return !/\.(PA|AS|DE|SW|L|TO|HM|SG|MU|BR|MI|MC|HE|VI|ST|CO)$/i.test(ticker.trim())
}
