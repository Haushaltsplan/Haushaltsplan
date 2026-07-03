/**
 * Erweiterter Regime-Kontext — Breadth, Sektor-Trends, SPY-Momentum.
 */

import 'server-only'

import { berechneReturnPct } from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type {
  MomentumBarDaily,
  MomentumRegimeKontext,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function runde1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Anteil Watchlist-Titel über MA20 (%). */
export function berechneWatchlistBreadth(techSnapshots: MomentumTechSnapshot[]): number | null {
  if (techSnapshots.length === 0) return null
  const ueber = techSnapshots.filter((t) => t.aboveMa20).length
  return runde1((ueber / techSnapshots.length) * 100)
}

/** 5-Tage-Return je Sektor-ETF. */
export function berechneSectorReturn5d(
  sectorBarsCache: Map<string, MomentumBarDaily[]>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [etf, bars] of sectorBarsCache) {
    if (bars.length < 6) continue
    const idx = bars.length - 1
    const ret = berechneReturnPct(bars, idx, 5)
    if (ret != null) out[etf] = ret
  }
  return out
}

export function berechneRegimeKontext(
  techSnapshots: MomentumTechSnapshot[],
  spyBars: MomentumBarDaily[],
  sectorBarsCache: Map<string, MomentumBarDaily[]>,
): MomentumRegimeKontext {
  let spyReturn5dPct: number | null = null
  if (spyBars.length >= 6) {
    spyReturn5dPct = berechneReturnPct(spyBars, spyBars.length - 1, 5)
  }

  return {
    spyReturn5dPct,
    watchlistBreadthPct: berechneWatchlistBreadth(techSnapshots),
    sectorReturn5d: berechneSectorReturn5d(sectorBarsCache),
  }
}
