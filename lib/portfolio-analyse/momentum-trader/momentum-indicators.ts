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
