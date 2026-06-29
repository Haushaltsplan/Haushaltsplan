import 'server-only'

import { ladeMarketbeatIpoDatum } from '@/lib/portfolio-analyse/marketbeat-beat-miss-historie-server'
import { ladeYahooIpoDatum } from '@/lib/portfolio-analyse/momentum-trader/momentum-yahoo-ipo-server'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; ipo: string | null }>()

/** IPO-Datum: MarketBeat (Scraper) → Yahoo quoteSummary (Scraper). Keine API-Keys. */
export async function ladeMomentumIpoDatum(
  symbol: string,
  symbolYahoo?: string | null,
): Promise<string | null> {
  const sym = symbol.trim().toUpperCase()
  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ipo

  const mb = await ladeMarketbeatIpoDatum(sym, symbolYahoo ?? sym)
  if (mb) {
    cache.set(sym, { at: Date.now(), ipo: mb })
    return mb
  }

  const yh = await ladeYahooIpoDatum(symbolYahoo ?? sym)
  cache.set(sym, { at: Date.now(), ipo: yh })
  return yh
}
