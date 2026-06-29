import 'server-only'

import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { ladeStooqOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-stooq-ohlcv-server'
import type { MomentumBarDaily } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeYahooOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/yahoo-ohlcv-server'

function mergeBarSerien(...serien: MomentumBarDaily[][]): MomentumBarDaily[] {
  const map = new Map<string, MomentumBarDaily>()
  for (const serie of serien) {
    for (const b of serie) map.set(b.handelstag, b)
  }
  return [...map.values()].sort((a, b) => a.handelstag.localeCompare(b.handelstag))
}

/** EU-/XETRA-Titel → Stooq bevorzugen. */
function istEuOderXetra(symbol: string): boolean {
  const u = symbol.trim().toUpperCase()
  if (u.startsWith('^')) return false
  if (!u.includes('.')) return false
  return /\.(DE|F|PA|AS|BR|L|SW|MI|MC|TO|V|HK|SG|T|AX|ST|HE|CO|OL|IR|LS|IC|VI)$/i.test(u)
}

function waehlePrimaerUndFallback(
  sym: string,
  yahoo: MomentumBarDaily[],
  stooq: MomentumBarDaily[],
): MomentumBarDaily[] {
  if (yahoo.length === 0) return stooq
  if (stooq.length === 0) return yahoo

  const eu = istEuOderXetra(sym)
  const primaer = eu ? stooq : yahoo
  const fallback = eu ? yahoo : stooq

  if (primaer.length >= fallback.length * 0.85) {
    return mergeBarSerien(fallback, primaer)
  }
  if (fallback.length > primaer.length * 1.15) {
    return mergeBarSerien(primaer, fallback)
  }
  return mergeBarSerien(fallback, primaer)
}

/**
 * OHLCV nur via Scraper: Yahoo Chart + Stooq CSV (keine API-Keys).
 * EU: Stooq-first · US: Yahoo-first · Lücken werden gemerged.
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
  for (const sym of uniq) {
    const bars = waehlePrimaerUndFallback(sym, yahooMap.get(sym) ?? [], stooqMap.get(sym) ?? [])
    if (bars.length > 0) out.set(sym, bars)
  }
  return out
}
