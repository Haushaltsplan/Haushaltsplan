import 'server-only'

import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'
import { momentumEarningsTicker } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import type { MomentumLiveKurs } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const CACHE_MS = 90_000
const cache = new Map<string, { at: number; data: MomentumLiveKurs | null }>()

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

type YahooPriceRow = {
  regularMarketPrice?: { raw?: number }
  regularMarketPreviousClose?: { raw?: number }
  preMarketPrice?: { raw?: number }
  postMarketPrice?: { raw?: number }
  marketState?: string
}

/** Live-/Extended-Hours-Kurs via Yahoo quoteSummary (Pre/Post/Regular). */
export async function ladeMomentumLiveKurs(
  symbolYahoo: string,
  opts?: { skipCache?: boolean },
): Promise<MomentumLiveKurs | null> {
  const sym = momentumEarningsTicker(symbolYahoo.trim().toUpperCase())
  if (!sym) return null

  if (!opts?.skipCache) {
    const hit = cache.get(sym)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  }

  const auth = await holeYahooFinanceAuth()
  if (!auth) {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'price')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(14_000),
    })
    if (!res.ok) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const row = (await res.json()).quoteSummary?.result?.[0]?.price as YahooPriceRow | undefined
    if (!row) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const state = (row.marketState ?? '').toUpperCase()
    const prevClose = row.regularMarketPreviousClose?.raw ?? null
    let quelle: MomentumLiveKurs['quelle'] = 'regular'
    let preis = row.regularMarketPrice?.raw ?? null

    if (state === 'PRE' && row.preMarketPrice?.raw != null) {
      preis = row.preMarketPrice.raw
      quelle = 'pre'
    } else if ((state === 'POST' || state === 'POSTPOST') && row.postMarketPrice?.raw != null) {
      preis = row.postMarketPrice.raw
      quelle = 'post'
    } else if (row.regularMarketPrice?.raw != null) {
      preis = row.regularMarketPrice.raw
      quelle = 'regular'
    } else if (row.postMarketPrice?.raw != null) {
      preis = row.postMarketPrice.raw
      quelle = 'post'
    } else if (row.preMarketPrice?.raw != null) {
      preis = row.preMarketPrice.raw
      quelle = 'pre'
    }

    if (preis == null || !Number.isFinite(preis) || preis <= 0) {
      cache.set(sym, { at: Date.now(), data: null })
      return null
    }

    const gapVsPrevClosePct =
      prevClose != null && prevClose > 0
        ? runde4(((preis - prevClose) / prevClose) * 100)
        : null

    const data: MomentumLiveKurs = {
      preis: runde4(preis),
      quelle,
      marketState: row.marketState ?? null,
      gapVsPrevClosePct,
      aktualisiertAm: new Date().toISOString(),
    }
    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    cache.set(sym, { at: Date.now(), data: null })
    return null
  }
}
