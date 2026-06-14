import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
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

function parseSectors(row: Record<string, unknown>): EtfBreakdown['sectors'] {
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

function parseCountries(row: Record<string, unknown>): EtfBreakdown['countries'] {
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

function parseTopHoldings(row: Record<string, unknown>): EtfBreakdown['topHoldings'] {
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
      const row: { name: string; symbol?: string; percentage: number } = { name, percentage: pct }
      if (h.symbol?.trim()) row.symbol = h.symbol.trim()
      return row
    })
    .filter((x): x is { name: string; symbol?: string; percentage: number } => x != null)
}

/** Top-Holdings & Sektor-/Ländergewichte eines ETFs (Yahoo Finance). */
export async function ladeEtfBreakdown(symbol: string): Promise<EtfBreakdown | null> {
  const sym = symbol.trim()
  if (!sym) return null

  const hit = cache.get(sym.toUpperCase())
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const auth = await holeYahooFinanceAuth()
  if (!auth) {
    cache.set(sym.toUpperCase(), { at: Date.now(), data: null })
    return null
  }

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'topHoldings,fundSectorWeightings,fundProfile,sectorWeightings')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) {
      cache.set(sym.toUpperCase(), { at: Date.now(), data: null })
      return null
    }
    const j = (await res.json()) as { quoteSummary?: { result?: Array<Record<string, unknown>> } }
    const row = j.quoteSummary?.result?.[0]
    if (!row) {
      cache.set(sym.toUpperCase(), { at: Date.now(), data: null })
      return null
    }

    const topHoldings = parseTopHoldings(row)
    if (topHoldings.length === 0) {
      cache.set(sym.toUpperCase(), { at: Date.now(), data: null })
      return null
    }

    const data: EtfBreakdown = {
      topHoldings,
      sectors: parseSectors(row),
      countries: parseCountries(row),
    }
    cache.set(sym.toUpperCase(), { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym.toUpperCase(), { at: Date.now(), data: null })
    return null
  }
}

export async function ladeEtfBreakdownsBatch(
  anfragen: Array<{ isin: string; symbolYahoo: string | null }>,
): Promise<Record<string, EtfBreakdown>> {
  const out: Record<string, EtfBreakdown> = {}
  const uniq = new Map<string, string>()
  for (const a of anfragen) {
    const isin = a.isin.trim().toUpperCase()
    const sym = a.symbolYahoo?.trim()
    if (!isin || !sym || uniq.has(isin)) continue
    uniq.set(isin, sym)
  }

  await Promise.all(
    [...uniq.entries()].map(async ([isin, sym]) => {
      const bd = await ladeEtfBreakdown(sym)
      if (bd) out[isin] = bd
    }),
  )

  return out
}
