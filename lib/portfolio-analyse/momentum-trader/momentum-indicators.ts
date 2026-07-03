/**
 * Momentum Trader — Indikatoren (rein regelbasiert, kein LLM).
 */

import type { MomentumBarDaily } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function runde2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Gap % am Handelstag: (open − prev_close) / prev_close × 100. */
export function berechneGapPct(bar: MomentumBarDaily, prevClose: number | null): number | null {
  if (prevClose == null || prevClose <= 0) return null
  return runde2(((bar.open - prevClose) / prevClose) * 100)
}

/** Relative Volumen-Stärke: volume / Durchschnitt der letzten n Tage (ohne heute). */
export function berechneRvol(bars: MomentumBarDaily[], index: number, fenster = 20): number | null {
  if (index <= 0 || index >= bars.length) return null
  const start = Math.max(0, index - fenster)
  const historie = bars.slice(start, index).map((b) => b.volume).filter((v) => v > 0)
  if (historie.length < 5) return null
  const avg = historie.reduce((s, v) => s + v, 0) / historie.length
  if (avg <= 0) return null
  return runde2(bars[index].volume / avg)
}

/** Average True Range (Wilder, n Perioden). */
export function berechneAtr(bars: MomentumBarDaily[], index: number, perioden = 14): number | null {
  if (index < perioden || bars.length < perioden + 1) return null
  const trs: number[] = []
  for (let i = index - perioden + 1; i <= index; i++) {
    const cur = bars[i]
    const prev = bars[i - 1]
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    )
    trs.push(tr)
  }
  if (trs.length === 0) return null
  return runde2(trs.reduce((s, v) => s + v, 0) / trs.length)
}

/** Einfacher gleitender Durchschnitt der Schlusskurse. */
export function berechneSma(bars: MomentumBarDaily[], index: number, perioden: number): number | null {
  if (index < perioden - 1) return null
  const slice = bars.slice(index - perioden + 1, index + 1)
  if (slice.length < perioden) return null
  const sum = slice.reduce((s, b) => s + b.close, 0)
  return runde2(sum / perioden)
}

/** Performance in % über n Handelstage. */
export function berechneReturnPct(bars: MomentumBarDaily[], index: number, tage: number): number | null {
  const start = index - tage
  if (start < 0) return null
  const von = bars[start].close
  const bis = bars[index].close
  if (von <= 0) return null
  return runde2(((bis - von) / von) * 100)
}

/** Relative Stärke vs. Benchmark über n Tage. */
export function berechneRelativeStaerke(
  tickerBars: MomentumBarDaily[],
  benchBars: MomentumBarDaily[],
  index: number,
  tage: number,
): number | null {
  const tickerRet = berechneReturnPct(tickerBars, index, tage)
  const benchRet = berechneReturnPct(benchBars, index, tage)
  if (tickerRet == null || benchRet == null) return null
  return runde2(tickerRet - benchRet)
}

/** RSI (Wilder, n Perioden). */
export function berechneRsi(bars: MomentumBarDaily[], index: number, perioden = 14): number | null {
  if (index < perioden) return null
  let gains = 0
  let losses = 0
  for (let i = index - perioden + 1; i <= index; i++) {
    const diff = bars[i].close - bars[i - 1].close
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  if (gains === 0 && losses === 0) return 50
  if (losses === 0) return 100
  const rs = gains / losses
  return runde2(100 - 100 / (1 + rs))
}

/** Bollinger-Bänder (SMA ± mult × StdDev). */
export function berechneBollingerBaender(
  bars: MomentumBarDaily[],
  index: number,
  perioden = 20,
  mult = 2,
): { upper: number; lower: number; mid: number } | null {
  const mid = berechneSma(bars, index, perioden)
  if (mid == null || index < perioden - 1) return null
  const slice = bars.slice(index - perioden + 1, index + 1)
  const variance = slice.reduce((s, b) => s + (b.close - mid) ** 2, 0) / perioden
  const std = Math.sqrt(variance)
  return {
    mid,
    upper: runde2(mid + mult * std),
    lower: runde2(mid - mult * std),
  }
}

/** Höchstes High über n Handelstage (inkl. index). */
export function berechneHoechstesHigh(bars: MomentumBarDaily[], index: number, tage: number): number | null {
  const start = Math.max(0, index - tage + 1)
  if (start > index) return null
  let max = -Infinity
  for (let i = start; i <= index; i++) max = Math.max(max, bars[i].high)
  return Number.isFinite(max) ? runde2(max) : null
}

/** Tiefstes Low über n Handelstage (inkl. index). */
export function berechneTiefstesLow(bars: MomentumBarDaily[], index: number, tage: number): number | null {
  const start = Math.max(0, index - tage + 1)
  if (start > index) return null
  let min = Infinity
  for (let i = start; i <= index; i++) min = Math.min(min, bars[i].low)
  return Number.isFinite(min) ? runde2(min) : null
}

/** Tages-Range (High − Low). */
export function berechneBarRange(bars: MomentumBarDaily[], index: number): number | null {
  if (index < 0 || index >= bars.length) return null
  const r = bars[index].high - bars[index].low
  return r > 0 ? runde2(r) : null
}

/** NR7: engste Range der letzten n Tage (am index). */
export function istNr7(bars: MomentumBarDaily[], index: number, fenster = 7): boolean {
  const range = berechneBarRange(bars, index)
  if (range == null || index < fenster - 1) return false
  for (let i = index - fenster + 1; i <= index; i++) {
    const r = berechneBarRange(bars, i)
    if (r != null && r < range) return false
  }
  return true
}

/** Inside Day: bar[idx] liegt vollständig innerhalb von bar[idx-1]. */
export function istInsideDay(bars: MomentumBarDaily[], index: number): boolean {
  if (index < 1) return false
  const inner = bars[index]
  const outer = bars[index - 1]
  return inner.high <= outer.high && inner.low >= outer.low
}

/** Frisches Golden Cross: MA20 kreuzt MA50 in den letzten lookback Tagen. */
export function istMaCrossFrisch(
  bars: MomentumBarDaily[],
  index: number,
  lookback = 5,
): boolean {
  const ma20 = berechneSma(bars, index, 20)
  const ma50 = berechneSma(bars, index, 50)
  if (ma20 == null || ma50 == null || ma20 <= ma50) return false
  const prev = index - lookback
  if (prev < 50) return false
  const ma20p = berechneSma(bars, prev, 20)
  const ma50p = berechneSma(bars, prev, 50)
  return ma20p != null && ma50p != null && ma20p <= ma50p
}
