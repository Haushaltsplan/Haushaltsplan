/**
 * Technischer Snapshot pro Symbol — Basis für tägliche Playbooks.
 */

import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  berechneAtr,
  berechneBollingerBaender,
  berechneGapPct,
  berechneHoechstesHigh,
  berechneRelativeStaerke,
  berechneReturnPct,
  berechneRsi,
  berechneRvol,
  berechneSma,
  berechneTiefstesLow,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import { RS_TAGE } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumBarDaily,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function runde1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Technische Kennzahlen am letzten Bar-Index berechnen. */
export function berechneTechSnapshot(
  symbol: string,
  bars: MomentumBarDaily[],
  spyBars: MomentumBarDaily[],
  sectorBars: MomentumBarDaily[],
  scanDate = heuteIsoUtc(),
): MomentumTechSnapshot | null {
  if (bars.length < 55) return null

  const idx = bars.length - 1
  const bar = bars[idx]
  const prevClose = idx > 0 ? bars[idx - 1].close : null
  const gapPct = berechneGapPct(bar, prevClose)
  const rvol = berechneRvol(bars, idx)
  const atr = berechneAtr(bars, idx)
  const ma20 = berechneSma(bars, idx, 20)
  const ma50 = berechneSma(bars, idx, 50)
  const rsi14 = berechneRsi(bars, idx, 14)
  const bb = berechneBollingerBaender(bars, idx, 20, 2)
  const high20d = berechneHoechstesHigh(bars, idx, 20)
  const high52w = berechneHoechstesHigh(bars, idx, Math.min(252, idx + 1))
  const low20d = berechneTiefstesLow(bars, idx, 20)
  const return20dPct = berechneReturnPct(bars, idx, RS_TAGE)

  const spyIdx = spyBars.findIndex((b) => b.handelstag === bar.handelstag)
  const rsVsSpy20d =
    spyIdx >= 0 ? berechneRelativeStaerke(bars, spyBars, idx, RS_TAGE) : null

  let rsVsSector20d: number | null = null
  if (sectorBars.length > 0) {
    const secIdx = sectorBars.findIndex((b) => b.handelstag === bar.handelstag)
    if (secIdx >= 0) {
      rsVsSector20d = berechneRelativeStaerke(bars, sectorBars, idx, RS_TAGE)
    }
  }

  const distHigh52wPct =
    high52w != null && high52w > 0
      ? runde1(((bar.close - high52w) / high52w) * 100)
      : null

  const atrPct =
    atr != null && bar.close > 0 ? runde1((atr / bar.close) * 100) : null

  const uptrend = ma20 != null && ma50 != null && ma20 > ma50 && bar.close >= ma20 * 0.98
  const downtrend = ma20 != null && ma50 != null && ma20 < ma50 && bar.close <= ma20 * 1.02
  const aboveMa20 = ma20 != null && bar.close >= ma20

  let range20dPct: number | null = null
  let distRangeLowPct: number | null = null
  let distRangeHighPct: number | null = null
  if (high20d != null && low20d != null && bar.close > 0) {
    range20dPct = runde1(((high20d - low20d) / bar.close) * 100)
    distRangeLowPct = runde1(((bar.close - low20d) / bar.close) * 100)
    distRangeHighPct = runde1(((high20d - bar.close) / bar.close) * 100)
  }

  return {
    symbol,
    scanDate,
    handelstag: bar.handelstag,
    close: bar.close,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    gapPct,
    rvol,
    atr,
    atrPct,
    ma20,
    ma50,
    rsi14,
    bbUpper: bb?.upper ?? null,
    bbLower: bb?.lower ?? null,
    high20d,
    high52w,
    low20d,
    distHigh52wPct,
    return20dPct,
    rsVsSpy20d,
    rsVsSector20d,
    uptrend,
    downtrend,
    aboveMa20,
    range20dPct,
    distRangeLowPct,
    distRangeHighPct,
    shortFloatPct: null,
  }
}
