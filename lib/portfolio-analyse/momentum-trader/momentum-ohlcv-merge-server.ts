import 'server-only'

import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import {
  ladePolygonOhlcvTaeglich,
  polygonAktiv,
  yahooZuPolygonTicker,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-polygon-ohlcv-server'
import { ladeStooqOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-stooq-ohlcv-server'
import type { MomentumBarDaily } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeYahooOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/yahoo-ohlcv-server'

const POLYGON_PARALLEL = 3

function mergeBarSerien(primaer: MomentumBarDaily[], ergaenzung: MomentumBarDaily[]): MomentumBarDaily[] {
  const map = new Map<string, MomentumBarDaily>()
  for (const b of ergaenzung) map.set(b.handelstag, b)
  for (const b of primaer) map.set(b.handelstag, b)
  return [...map.values()].sort((a, b) => a.handelstag.localeCompare(b.handelstag))
}

function waehleBesteSerie(a: MomentumBarDaily[], b: MomentumBarDaily[]): MomentumBarDaily[] {
  if (a.length === 0) return b
  if (b.length === 0) return a
  if (b.length > a.length * 1.1) return mergeBarSerien(b, a)
  return mergeBarSerien(a, b)
}

/**
 * OHLCV aus mehreren Quellen: Yahoo → Polygon (US, optional) → Stooq-Fallback.
 */
export async function ladeMomentumOhlcvBatch(
  symbols: string[],
  vonDatum: string,
  bisDatum: string,
): Promise<Map<string, MomentumBarDaily[]>> {
  const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].filter(
    (s) => !s.startsWith('STOOQ:'),
  )
  if (uniq.length === 0) return new Map()

  const [yahooMap, stooqMap] = await Promise.all([
    ladeYahooOhlcvBatch(uniq, vonDatum, bisDatum),
    ladeStooqOhlcvBatch(uniq, vonDatum, bisDatum),
  ])

  const out = new Map<string, MomentumBarDaily[]>()

  const polygonSymbole = polygonAktiv()
    ? uniq.filter((s) => yahooZuPolygonTicker(s) != null && !s.startsWith('^'))
    : []

  const polygonMap = new Map<string, MomentumBarDaily[]>()
  for (const batch of teileArray(polygonSymbole, POLYGON_PARALLEL)) {
    await Promise.all(
      batch.map(async (sym) => {
        const bars = await ladePolygonOhlcvTaeglich(sym, vonDatum, bisDatum)
        if (bars.length > 0) polygonMap.set(sym, bars)
      }),
    )
  }

  for (const sym of uniq) {
    let bars = yahooMap.get(sym) ?? []
    const poly = polygonMap.get(sym)
    if (poly?.length) bars = waehleBesteSerie(bars, poly)
    const stooq = stooqMap.get(sym)
    if (stooq?.length) bars = mergeBarSerien(bars, stooq)
    if (bars.length > 0) out.set(sym, bars)
  }

  return out
}
