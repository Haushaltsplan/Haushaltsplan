import 'server-only'

import { finnhubSymbole } from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; ipoDatum: string | null }>()

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k.length > 0 ? k : null
}

/** IPO-Datum aus Finnhub company/profile2 (optional, kein Key = null). */
export async function ladeFinnhubIpoDatum(symbol: string): Promise<string | null> {
  const sym = symbol.trim().toUpperCase()
  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ipoDatum

  const key = finnhubKey()
  if (!key) {
    cache.set(sym, { at: Date.now(), ipoDatum: null })
    return null
  }

  for (const s of finnhubSymbole(sym)) {
    const u = new URL('https://finnhub.io/api/v1/stock/profile2')
    u.searchParams.set('symbol', s)
    u.searchParams.set('token', key)
    try {
      const res = await fetch(u.toString(), { next: { revalidate: 86_400 } })
      if (!res.ok) continue
      const raw = (await res.json()) as { ipo?: string }
      const ipo = raw.ipo?.slice(0, 10) ?? null
      if (ipo && /^\d{4}-\d{2}-\d{2}$/.test(ipo)) {
        cache.set(sym, { at: Date.now(), ipoDatum: ipo })
        return ipo
      }
    } catch {
      continue
    }
  }

  cache.set(sym, { at: Date.now(), ipoDatum: null })
  return null
}
