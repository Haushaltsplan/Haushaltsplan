import 'server-only'

import type { MomentumBarDaily } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const CACHE_REVALIDATE = 1800

function polygonKey(): string | null {
  const k = (
    process.env.POLYGON_API_KEY ??
    process.env.NEXT_PUBLIC_POLYGON_API_KEY ??
    ''
  ).trim()
  return k.length > 0 ? k : null
}

/** US-Yahoo-Ticker → Polygon (z. B. AAPL, BRK.B — keine .DE). */
export function yahooZuPolygonTicker(yahoo: string): string | null {
  const u = yahoo.trim().toUpperCase()
  if (!u || u.startsWith('^') || u.startsWith('STOOQ:')) return null
  const dot = u.indexOf('.')
  if (dot < 0) {
    if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(u)) return u
    return null
  }
  const suffix = u.slice(dot + 1)
  if (suffix === 'US') return u.slice(0, dot)
  return null
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

type PolygonAgg = {
  t?: number
  o?: number
  h?: number
  l?: number
  c?: number
  v?: number
}

/** Tägliche Aggregates von Polygon (nur US-Titel, optional POLYGON_API_KEY). */
export async function ladePolygonOhlcvTaeglich(
  yahooSymbol: string,
  vonDatum: string,
  bisDatum: string,
): Promise<MomentumBarDaily[]> {
  const key = polygonKey()
  const poly = yahooZuPolygonTicker(yahooSymbol)
  if (!key || !poly) return []

  const u = new URL(
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(poly)}/range/1/day/${vonDatum}/${bisDatum}`,
  )
  u.searchParams.set('adjusted', 'true')
  u.searchParams.set('sort', 'asc')
  u.searchParams.set('limit', '50000')
  u.searchParams.set('apiKey', key)

  try {
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': 'mein-haushalt/momentum-trader' },
      next: { revalidate: CACHE_REVALIDATE },
    })
    if (!res.ok) return []
    const j = (await res.json()) as { results?: PolygonAgg[] }
    const rows = j.results ?? []
    const ySym = yahooSymbol.trim().toUpperCase()
    const out: MomentumBarDaily[] = []

    for (const row of rows) {
      if (row.t == null || row.o == null || row.h == null || row.l == null || row.c == null) continue
      const d = new Date(row.t)
      const tag = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      if (![row.o, row.h, row.l, row.c].every((x) => Number.isFinite(x) && x > 0)) continue
      out.push({
        symbol: ySym,
        handelstag: tag,
        open: runde4(row.o),
        high: runde4(row.h),
        low: runde4(row.l),
        close: runde4(row.c),
        adjClose: runde4(row.c),
        volume: row.v != null && Number.isFinite(row.v) ? Math.round(row.v) : 0,
      })
    }
    return out
  } catch {
    return []
  }
}

export function polygonAktiv(): boolean {
  return polygonKey() != null
}
