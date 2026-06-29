import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_REVALIDATE = 86_400

const cache = new Map<string, { at: number; ipoDatum: string | null }>()

function tagAusUnix(sec: number): string | null {
  if (!Number.isFinite(sec) || sec <= 0) return null
  const d = new Date(sec * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

async function ladeYahooIpoDatumRoh(symbol: string): Promise<string | null> {
  const sym = symbol.trim().toUpperCase()
  if (!sym) return null

  const auth = await holeYahooFinanceAuth()
  if (!auth) return null

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'defaultKeyStatistics,summaryProfile')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return null

    const row = (await res.json()).quoteSummary?.result?.[0] as
      | {
          defaultKeyStatistics?: { firstTradeDateEpoch?: { raw?: number } }
          summaryProfile?: { startDate?: { raw?: number } }
        }
      | undefined

    const epoch =
      row?.defaultKeyStatistics?.firstTradeDateEpoch?.raw ??
      row?.summaryProfile?.startDate?.raw ??
      null
    if (epoch == null) return null
    return tagAusUnix(epoch)
  } catch {
    return null
  }
}

/** IPO-/Ersthandelstag aus Yahoo quoteSummary (Scraper, kein Finnhub). */
export async function ladeYahooIpoDatum(symbol: string): Promise<string | null> {
  const sym = symbol.trim().toUpperCase()
  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ipoDatum

  for (const kandidat of brokerSymbolKandidaten(sym)) {
    const ipo = await ladeYahooIpoDatumRoh(kandidat)
    if (ipo && /^\d{4}-\d{2}-\d{2}$/.test(ipo)) {
      cache.set(sym, { at: Date.now(), ipoDatum: ipo })
      return ipo
    }
  }

  cache.set(sym, { at: Date.now(), ipoDatum: null })
  return null
}
