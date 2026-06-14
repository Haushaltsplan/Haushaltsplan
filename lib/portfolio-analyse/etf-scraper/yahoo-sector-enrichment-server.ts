import 'server-only'

import { normalisiereSektor } from '@/lib/portfolio-analyse/sektor-normalisierung'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const sectorCache = new Map<string, { at: number; sector: string | null }>()

async function yahooSektorFuerSymbol(symbol: string): Promise<string | null> {
  const sym = symbol.trim().toUpperCase().split('.')[0]
  if (!sym) return null

  const hit = sectorCache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sector

  const auth = await holeYahooFinanceAuth()
  if (!auth) return null

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'assetProfile')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) {
      sectorCache.set(sym, { at: Date.now(), sector: null })
      return null
    }
    const j = (await res.json()) as {
      quoteSummary?: { result?: Array<{ assetProfile?: { sector?: string; industry?: string } }> }
    }
    const profile = j.quoteSummary?.result?.[0]?.assetProfile
    const sector = normalisiereSektor(profile?.sector ?? profile?.industry ?? null)
    const out = sector === 'Sonstige' ? null : sector
    sectorCache.set(sym, { at: Date.now(), sector: out })
    return out
  } catch {
    sectorCache.set(sym, { at: Date.now(), sector: null })
    return null
  }
}

/** Batch-Sektor-Lookup für Symbole (API/Client-Nachladen). */
export async function holeSektorenFuerSymbole(symbols: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const unique = [
    ...new Set(
      symbols
        .map((s) => s.trim().toUpperCase().split('.')[0]!)
        .filter(Boolean),
    ),
  ]
  for (let i = 0; i < unique.length; i += 15) {
    const chunk = unique.slice(i, i + 15)
    await Promise.all(
      chunk.map(async (sym) => {
        const sector = await yahooSektorFuerSymbol(sym)
        if (sector) out[sym] = sector
      }),
    )
  }
  return out
}

/** Reichert Holdings ohne Sektor per Yahoo assetProfile an (gecacht). */
export async function reichereHoldingsMitSektor<
  T extends { symbol?: string; sectorName?: string },
>(holdings: T[], maxLookups = 120): Promise<T[]> {
  const fehlend = holdings.filter((h) => !h.sectorName && h.symbol).slice(0, maxLookups)
  if (!fehlend.length) return holdings

  const updates = new Map<string, string>()
  for (let i = 0; i < fehlend.length; i += 15) {
    const chunk = fehlend.slice(i, i + 15)
    await Promise.all(
      chunk.map(async (h) => {
        const sym = h.symbol!.trim().toUpperCase()
        const basis = sym.split('.')[0]!
        const sector = await yahooSektorFuerSymbol(basis)
        if (sector) updates.set(sym, sector)
      }),
    )
  }

  if (updates.size === 0) return holdings
  return holdings.map((h) => {
    if (h.sectorName || !h.symbol) return h
    const sym = h.symbol.trim().toUpperCase()
    const sector = updates.get(sym) ?? updates.get(sym.split('.')[0]!)
    return sector ? { ...h, sectorName: sector } : h
  })
}
