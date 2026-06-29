/**
 * Earnings-Reaktionsbar: BMO vs. AMC vs. Auto-Erkennung.
 */

import { berechneGapPct } from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type {
  MomentumBarDaily,
  MomentumEarningsZeit,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type EarningsReaktionsBar = {
  barIdx: number
  prevClose: number
  effektiveZeit: MomentumEarningsZeit
}

export function findeBarAbDatum(bars: MomentumBarDaily[], abDatum: string): number | null {
  const idx = bars.findIndex((b) => b.handelstag >= abDatum)
  return idx >= 0 ? idx : null
}

function bmoReaktion(bars: MomentumBarDaily[], earningsDate: string): EarningsReaktionsBar | null {
  const barIdx = findeBarAbDatum(bars, earningsDate)
  if (barIdx == null || barIdx < 1) return null
  return {
    barIdx,
    prevClose: bars[barIdx - 1].close,
    effektiveZeit: 'bmo',
  }
}

function amcReaktion(bars: MomentumBarDaily[], earningsDate: string): EarningsReaktionsBar | null {
  const earningsIdx = findeBarAbDatum(bars, earningsDate)
  if (earningsIdx == null) return null
  const reactIdx = earningsIdx + 1
  if (reactIdx >= bars.length) return null
  const earningsClose = bars[earningsIdx].close
  if (earningsClose <= 0) return null
  return {
    barIdx: reactIdx,
    prevClose: earningsClose,
    effektiveZeit: 'amc',
  }
}

function autoReaktion(bars: MomentumBarDaily[], earningsDate: string): EarningsReaktionsBar | null {
  const bmo = bmoReaktion(bars, earningsDate)
  const amc = amcReaktion(bars, earningsDate)
  if (!bmo && !amc) return null
  if (!bmo) return amc
  if (!amc) return bmo

  const gapBmo = Math.abs(berechneGapPct(bars[bmo.barIdx], bmo.prevClose) ?? 0)
  const gapAmc = Math.abs(berechneGapPct(bars[amc.barIdx], amc.prevClose) ?? 0)
  return gapAmc >= gapBmo ? amc : bmo
}

/** Reaktions-Handelstag für Gap/RVOL (AMC = Folgetag, BMO = Earnings-Tag). */
export function findeEarningsReaktionsBar(
  bars: MomentumBarDaily[],
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
): EarningsReaktionsBar | null {
  if (timeBmoAmc === 'bmo') return bmoReaktion(bars, earningsDate)
  if (timeBmoAmc === 'amc' || timeBmoAmc === 'dmh') return amcReaktion(bars, earningsDate)
  return autoReaktion(bars, earningsDate)
}
