import 'server-only'

import { unzipSync } from 'fflate'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'

const SPY_XLSX_URL =
  'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx'

const CACHE_MS = 24 * 60 * 60 * 1000
let cache: { at: number; rows: Array<{ name: string; symbol: string; weight: number }> } | null = null

const TICKER_RE = /^[A-Z]{1,6}(?:\.[A-Z])?$/
const SKIP_NAME = new Set(['Name', 'Shares Held', 'Identifier', '-'])
const SKIP_SYMBOL = new Set(['Ticker', 'Local Currency', 'USD', 'SEDOL'])

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) =>
    m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
  )
}

function rowToMap(xml: string, strings: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)><v>([^<]*)<\/v><\/c>/g)) {
    map[c[1]] = c[3].includes(' t="s"') ? strings[Number(c[4])] : c[4]
  }
  return map
}

function parseSpyRows(buf: Uint8Array): Array<{ name: string; symbol: string; weight: number }> {
  const files = unzipSync(buf)
  const sharedXml = files['xl/sharedStrings.xml']
  const sheetXml = files['xl/worksheets/sheet1.xml']
  if (!sharedXml || !sheetXml) return []

  const strings = parseSharedStrings(new TextDecoder().decode(sharedXml))
  const sheet = new TextDecoder().decode(sheetXml)
  const rows = [...sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]

  const out: Array<{ name: string; symbol: string; weight: number }> = []
  for (const row of rows) {
    const m = rowToMap(row[2], strings)
    let name = m.A?.trim()
    let symbol = m.B?.trim()
    let weight = parseFloat(m.E ?? '')

    if (!TICKER_RE.test(symbol ?? '') && TICKER_RE.test(m.D ?? '')) {
      name = m.C?.trim()
      symbol = m.D?.trim()
      weight = parseFloat(m.E ?? '')
    }

    if (!name || !symbol || !TICKER_RE.test(symbol) || !Number.isFinite(weight) || weight <= 0) continue
    if (SKIP_NAME.has(name) || SKIP_SYMBOL.has(symbol) || name.length < 4) continue
    out.push({ name, symbol, weight })
  }
  return out
}

async function ladeSpyHoldingsRaw(): Promise<Array<{ name: string; symbol: string; weight: number }>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows

  const res = await fetch(SPY_XLSX_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeinHaushalt/1.0)' },
    cache: 'no-store',
  })
  if (!res.ok) return cache?.rows ?? []

  const buf = new Uint8Array(await res.arrayBuffer())
  const rows = parseSpyRows(buf)
  if (rows.length >= 400) cache = { at: Date.now(), rows }
  return rows
}

/** Vollständige S&P-500-Gewichtung (SPDR SPY Holdings-Datei). */
export async function ladeSp500CapBreakdown(): Promise<EtfBreakdown | null> {
  const rows = await ladeSpyHoldingsRaw()
  if (rows.length < 400) return null

  const sum = rows.reduce((s, r) => s + r.weight, 0)
  const factor = sum > 0 ? 100 / sum : 1

  return {
    topHoldings: rows.map((r) => ({
      name: r.name,
      symbol: r.symbol,
      percentage: r.weight * factor,
    })),
    sectors: [],
    countries: [],
  }
}

/** Alle S&P-500-Konstituenten gleichgewichtet. */
export async function ladeSp500EqualBreakdown(): Promise<EtfBreakdown | null> {
  const rows = await ladeSpyHoldingsRaw()
  if (rows.length < 400) return null
  const pct = 100 / rows.length
  return {
    topHoldings: rows.map((r) => ({
      name: r.name,
      symbol: r.symbol,
      percentage: pct,
    })),
    sectors: [],
    countries: [],
  }
}
