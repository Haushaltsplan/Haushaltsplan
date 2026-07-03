/**
 * Trade-Outcome-Simulation auf Daily-Bars (Stop/Ziel vor Timeout).
 */

import type { MomentumBarDaily, MomentumRichtung } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type BacktestTradeOutcome = 'win' | 'loss' | 'timeout'

/** Prüft ob Stop oder Ziel in den nächsten maxTage Handelstagen getroffen wird. */
export function simuliereTradeOutcome(
  bars: MomentumBarDaily[],
  entryIdx: number,
  entry: number,
  stop: number,
  target: number,
  richtung: MomentumRichtung,
  maxTage = 5,
): BacktestTradeOutcome {
  if (
    !Number.isFinite(entry) ||
    entry <= 0 ||
    !Number.isFinite(stop) ||
    !Number.isFinite(target) ||
    entryIdx < 0 ||
    entryIdx >= bars.length
  ) {
    return 'timeout'
  }

  for (let d = 1; d <= maxTage; d++) {
    const idx = entryIdx + d
    if (idx >= bars.length) break
    const bar = bars[idx]

    if (richtung === 'long') {
      if (bar.low <= stop) return 'loss'
      if (bar.high >= target) return 'win'
    } else {
      if (bar.high >= stop) return 'loss'
      if (bar.low <= target) return 'win'
    }
  }

  const lastIdx = Math.min(entryIdx + maxTage, bars.length - 1)
  if (lastIdx <= entryIdx) return 'timeout'
  const exit = bars[lastIdx].close
  const move = richtung === 'long' ? exit - entry : entry - exit
  if (move > 0) return 'win'
  if (move < 0) return 'loss'
  return 'timeout'
}
