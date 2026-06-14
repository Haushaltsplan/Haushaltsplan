import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import { ladeAmundiEtfBreakdown } from '@/lib/portfolio-analyse/etf-scraper/amundi-breakdown-server'
import { ladeIndexEtfBreakdown } from '@/lib/portfolio-analyse/etf-scraper/index-holdings-server'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: EtfBreakdown | null }>()

function rawPct(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v <= 1 ? v * 100 : v
  }
  if (typeof v === 'object' && v !== null && 'raw' in v) {
    const raw = (v as { raw?: number }).raw
    if (raw != null && Number.isFinite(raw)) return raw <= 1 ? raw * 100 : raw
  }
  return null
}

function parseYahooSectors(row: Record<string, unknown>): EtfBreakdown['sectors'] {
  const sw = row.sectorWeightings as { sectors?: Array<Record<string, unknown>> } | undefined
  if (sw?.sectors?.length) {
    const out: EtfBreakdown['sectors'] = []
    for (const s of sw.sectors) {
      for (const [k, v] of Object.entries(s)) {
        const pct = rawPct(v)
        if (pct != null && pct > 0) out.push({ sectorName: k, percentage: pct })
      }
    }
    if (out.length) return out
  }

  const fsw = row.fundSectorWeightings as { sectorWeightings?: Array<{ sector?: string; weight?: unknown }> } | undefined
  if (fsw?.sectorWeightings?.length) {
    return fsw.sectorWeightings
      .map((s) => {
        const pct = rawPct(s.weight)
        const sectorName = s.sector?.trim()
        if (!sectorName || pct == null || pct <= 0) return null
        return { sectorName, percentage: pct }
      })
      .filter((x): x is { sectorName: string; percentage: number } => x != null)
  }

  return []
}

function parseYahooCountries(row: Record<string, unknown>): EtfBreakdown['countries'] {
  const cw = row.fundProfile as { countryWeightings?: Array<{ country?: string; weight?: unknown }> } | undefined
  if (cw?.countryWeightings?.length) {
    return cw.countryWeightings
      .map((c) => {
        const pct = rawPct(c.weight)
        const countryCode = c.country?.trim()
        if (!countryCode || pct == null || pct <= 0) return null
        return { countryCode, percentage: pct }
      })
      .filter((x): x is { countryCode: string; percentage: number } => x != null)
  }
  return []
}

function parseYahooTopHoldings(row: Record<string, unknown>): EtfBreakdown['topHoldings'] {
  const th = row.topHoldings as
    | {
        holdings?: Array<{
          symbol?: string
          holdingName?: string
          holdingPercent?: unknown
        }>
      }
    | undefined
  if (!th?.holdings?.length) return []

  return th.holdings
    .map((h) => {
      const pct = rawPct(h.holdingPercent)
      const name = (h.holdingName ?? h.symbol ?? '').trim()
      if (!name || pct == null || pct <= 0) return null
      const out: { name: string; symbol?: string; percentage: number } = { name, percentage: pct }
      if (h.symbol?.trim()) out.symbol = h.symbol.trim()
      return out
    })
    .filter((x): x is { name: string; symbol?: string; percentage: number } => x != null)
}

async function ladeYahooEtfBreakdown(symbol: string): Promise<EtfBreakdown | null> {
  const sym = symbol.trim()
  if (!sym) return null

  const auth = await holeYahooFinanceAuth()
  if (!auth) return null

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'topHoldings,fundSectorWeightings,fundProfile,sectorWeightings')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = (await res.json()) as { quoteSummary?: { result?: Array<Record<string, unknown>> } }
    const row = j.quoteSummary?.result?.[0]
    if (!row) return null

    const topHoldings = parseYahooTopHoldings(row)
    if (topHoldings.length === 0) return null

    return {
      topHoldings,
      sectors: parseYahooSectors(row),
      countries: parseYahooCountries(row),
    }
  } catch {
    return null
  }
}

/** ETF-Zusammensetzung: Amundi-Scraper → Yahoo-Fallback. */
export async function ladeEtfBreakdownFuerIsin(
  isin: string,
  symbolYahoo: string | null,
): Promise<EtfBreakdown | null> {
  const key = isin.trim().toUpperCase()
  if (!key) return null

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  let data = await ladeIndexEtfBreakdown(key)
  if (!data) data = await ladeAmundiEtfBreakdown(key)
  if (!data && symbolYahoo) {
    data = await ladeYahooEtfBreakdown(symbolYahoo)
  }

  cache.set(key, { at: Date.now(), data })
  return data
}

export async function ladeEtfBreakdownsBatch(
  anfragen: Array<{ isin: string; symbolYahoo: string | null }>,
): Promise<Record<string, EtfBreakdown>> {
  const out: Record<string, EtfBreakdown> = {}
  const uniq = new Map<string, string | null>()
  for (const a of anfragen) {
    const isin = a.isin.trim().toUpperCase()
    if (!isin || uniq.has(isin)) continue
    uniq.set(isin, a.symbolYahoo?.trim() || null)
  }

  await Promise.all(
    [...uniq.entries()].map(async ([isin, sym]) => {
      const bd = await ladeEtfBreakdownFuerIsin(isin, sym)
      if (bd) out[isin] = bd
    }),
  )

  return out
}
