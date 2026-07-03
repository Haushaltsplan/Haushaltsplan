/** Yahoo quoteSummary — Insider- & Institutionsbesitz. */

import 'server-only'

import type { YahooHoldersPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { holeYahooFinanceAuth } from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const CACHE_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: YahooHoldersPaket | null }>()

function rawNum(o: Record<string, { raw?: number }> | undefined, k: string): number | null {
  const v = o?.[k]?.raw
  return v != null && Number.isFinite(v) ? v : null
}

export async function ladeYahooHolders(symbol: string): Promise<YahooHoldersPaket | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const auth = await holeYahooFinanceAuth()
  if (!auth) {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }

  try {
    const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
    u.searchParams.set('modules', 'majorHoldersBreakdown,institutionOwnership,defaultKeyStatistics')
    u.searchParams.set('crumb', auth.crumb)
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': YAHOO_UA, Cookie: auth.cookie, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const j = (await res.json()) as {
      quoteSummary?: {
        result?: Array<{
          majorHoldersBreakdown?: Record<string, { raw?: number }>
          institutionOwnership?: { ownershipList?: Array<{ organization?: string; position?: { raw?: number } }> }
          defaultKeyStatistics?: Record<string, { raw?: number }>
        }>
      }
    }
    const row = j.quoteSummary?.result?.[0]
    if (!row) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const mh = row.majorHoldersBreakdown
    const dks = row.defaultKeyStatistics
    const instList = row.institutionOwnership?.ownershipList ?? []
    const instShares = instList.reduce((s, e) => s + (e.position?.raw ?? 0), 0) || null

    const data: YahooHoldersPaket = {
      insiderPct: rawNum(mh, 'insidersPercentHeld'),
      institutionenPct: rawNum(mh, 'institutionsPercentHeld'),
      insiderShares: null,
      institutionenShares: instShares,
      floatShares: rawNum(dks, 'floatShares'),
      sharesOutstanding: rawNum(dks, 'sharesOutstanding'),
      quelle: 'yahoo',
    }
    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
