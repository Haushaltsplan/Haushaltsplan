/**
 * Stop & Take-Profit aus Marktstruktur (Kerzen, Swings, MA, Range) — nicht nur ATR-%.
 */

import {
  ATR_STOP_FAKTOR,
  REWARD_RISK_RATIO,
  TRADE_MIN_REWARD_RISK,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  berechneAtr,
  berechneBollingerBaender,
  berechneHoechstesHigh,
  berechneSma,
  berechneTiefstesLow,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type { MomentumPositionsVorschlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import type {
  MomentumBarDaily,
  MomentumRichtung,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const SWING_LOOKBACK = 10
const ATR_PUFFER = 0.3
const MIN_STOP_ATR = 0.9
const MAX_STOP_ATR = 2.75

export type StrukturLevelOpts = {
  atr?: number | null
  tech?: MomentumTechSnapshot | null
  /** Index des Einstiegs-Bars (Default: letzter). */
  barIdx?: number
  /** Gap-/Earnings-Reaktionsbar — Stop typisch über/unter deren High/Low. */
  reactionBar?: MomentumBarDaily | null
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

function runde2(n: number): number {
  return Math.round(n * 100) / 100
}

function swingLowVorBar(bars: MomentumBarDaily[], idx: number, lookback: number): number | null {
  if (idx <= 0) return null
  const start = Math.max(0, idx - lookback)
  let min = Infinity
  for (let i = start; i < idx; i++) min = Math.min(min, bars[i]!.low)
  return Number.isFinite(min) ? min : null
}

function swingHighVorBar(bars: MomentumBarDaily[], idx: number, lookback: number): number | null {
  if (idx <= 0) return null
  const start = Math.max(0, idx - lookback)
  let max = -Infinity
  for (let i = start; i < idx; i++) max = Math.max(max, bars[i]!.high)
  return Number.isFinite(max) ? max : null
}

function clampStopLong(entry: number, strukturStop: number, atr: number): { stop: number; basis: string } {
  const minStop = entry - atr * MAX_STOP_ATR
  const maxStop = entry - atr * MIN_STOP_ATR
  let stop = strukturStop
  let basis = 'Struktur'
  if (stop >= entry) {
    stop = maxStop
    basis = 'ATR-Mindestabstand'
  } else if (stop > maxStop) {
    stop = maxStop
    basis = 'ATR-Mindestabstand (Struktur zu eng)'
  } else if (stop < minStop) {
    stop = minStop
    basis = 'ATR-Max (Struktur zu weit)'
  }
  return { stop: runde4(stop), basis }
}

function clampStopShort(entry: number, strukturStop: number, atr: number): { stop: number; basis: string } {
  const minStop = entry + atr * MIN_STOP_ATR
  const maxStop = entry + atr * MAX_STOP_ATR
  let stop = strukturStop
  let basis = 'Struktur'
  if (stop <= entry) {
    stop = minStop
    basis = 'ATR-Mindestabstand'
  } else if (stop < minStop) {
    stop = minStop
    basis = 'ATR-Mindestabstand (Struktur zu eng)'
  } else if (stop > maxStop) {
    stop = maxStop
    basis = 'ATR-Max (Struktur zu weit)'
  }
  return { stop: runde4(stop), basis }
}

function waehleTargetLong(
  entry: number,
  stop: number,
  kandidaten: Array<{ preis: number; label: string }>,
  minRr: number,
): { target: number; basis: string } {
  const risk = entry - stop
  const minTarget = entry + risk * minRr
  const fallback = entry + risk * REWARD_RISK_RATIO

  const gueltig = kandidaten
    .filter((k) => k.preis > minTarget)
    .sort((a, b) => a.preis - b.preis)

  if (gueltig.length > 0) {
    return { target: runde4(gueltig[0]!.preis), basis: gueltig[0]!.label }
  }

  return { target: runde4(fallback), basis: '2:1 R/R (kein Widerstand näher)' }
}

function waehleTargetShort(
  entry: number,
  stop: number,
  kandidaten: Array<{ preis: number; label: string }>,
  minRr: number,
): { target: number; basis: string } {
  const risk = stop - entry
  const maxTarget = entry - risk * minRr
  const fallback = entry - risk * REWARD_RISK_RATIO

  const gueltig = kandidaten
    .filter((k) => k.preis < maxTarget)
    .sort((a, b) => b.preis - a.preis)

  if (gueltig.length > 0) {
    return { target: runde4(gueltig[0]!.preis), basis: gueltig[0]!.label }
  }

  return { target: runde4(fallback), basis: '2:1 R/R (keine Unterstützung näher)' }
}

/**
 * Stop unter/über Struktur + Ziel an Widerstand/Unterstützung.
 */
export function berechneStrukturTradeLevels(
  entryPrice: number,
  richtung: MomentumRichtung,
  bars: MomentumBarDaily[],
  opts: StrukturLevelOpts = {},
): (MomentumPositionsVorschlag & {
  stopBasis: string
  targetBasis: string
  rewardRisk: number
}) | null {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || bars.length < 25) return null

  const idx = opts.barIdx ?? bars.length - 1
  if (idx < 20) return null

  const atr = opts.atr ?? berechneAtr(bars, idx) ?? opts.tech?.atr
  if (atr == null || atr <= 0) return null

  const tech = opts.tech
  const ma20 = tech?.ma20 ?? berechneSma(bars, idx, 20)
  const ma50 = tech?.ma50 ?? berechneSma(bars, idx, 50)
  const low20 = tech?.low20d ?? berechneTiefstesLow(bars, idx, 20)
  const high20 = tech?.high20d ?? berechneHoechstesHigh(bars, idx, 20)
  const high52 = tech?.high52w ?? berechneHoechstesHigh(bars, idx, Math.min(252, idx + 1))
  const bb = berechneBollingerBaender(bars, idx, 20, 2)
  const swingLow = swingLowVorBar(bars, idx, SWING_LOOKBACK)
  const swingHigh = swingHighVorBar(bars, idx, SWING_LOOKBACK)
  const bar = bars[idx]!
  const prev = idx > 0 ? bars[idx - 1]! : null
  const react = opts.reactionBar
  const puffer = atr * ATR_PUFFER
  const minRr = TRADE_MIN_REWARD_RISK

  if (richtung === 'long') {
    const strukturKandidaten: Array<{ preis: number; label: string }> = []
    if (react) strukturKandidaten.push({ preis: react.low, label: 'Reaktionsbar-Tief' })
    if (swingLow != null) strukturKandidaten.push({ preis: swingLow, label: 'Swing-Tief ' + SWING_LOOKBACK + 'T' })
    if (low20 != null) strukturKandidaten.push({ preis: low20, label: '20T-Tief' })
    if (bar.low < entryPrice) strukturKandidaten.push({ preis: bar.low, label: 'Tages-Tief' })
    if (prev && prev.low < entryPrice) strukturKandidaten.push({ preis: prev.low, label: 'Vortages-Tief' })
    if (ma20 != null && ma20 < entryPrice) strukturKandidaten.push({ preis: ma20, label: 'MA20' })
    if (ma50 != null && ma50 < entryPrice) strukturKandidaten.push({ preis: ma50, label: 'MA50' })
    if (bb?.lower != null && bb.lower < entryPrice) {
      strukturKandidaten.push({ preis: bb.lower, label: 'Bollinger unten' })
    }

    const unterEntry = strukturKandidaten.filter((k) => k.preis < entryPrice)
    let strukturStop: number
    let stopLabel: string
    if (unterEntry.length > 0) {
      const best = unterEntry.sort((a, b) => b.preis - a.preis)[0]!
      strukturStop = best.preis - puffer
      stopLabel = best.label + ' − ATR-Puffer'
    } else {
      strukturStop = entryPrice - atr * ATR_STOP_FAKTOR
      stopLabel = 'ATR-Fallback'
    }

    const { stop, basis: clampBasis } = clampStopLong(entryPrice, strukturStop, atr)
    const stopBasis = stopLabel + (clampBasis !== 'Struktur' ? ' · ' + clampBasis : '')

    const targetKandidaten: Array<{ preis: number; label: string }> = []
    if (high20 != null && high20 > entryPrice) targetKandidaten.push({ preis: high20, label: '20T-Hoch' })
    if (swingHigh != null && swingHigh > entryPrice) {
      targetKandidaten.push({ preis: swingHigh, label: 'Swing-Hoch' })
    }
    if (high52 != null && high52 > entryPrice) targetKandidaten.push({ preis: high52, label: '52W-Hoch' })
    if (bb?.upper != null && bb.upper > entryPrice) {
      targetKandidaten.push({ preis: bb.upper, label: 'Bollinger oben' })
    }
    if (ma20 != null && ma20 > entryPrice && tech?.uptrend) {
      targetKandidaten.push({ preis: ma20 + atr, label: 'MA20-Erweiterung' })
    }

    const { target, basis: targetBasis } = waehleTargetLong(entryPrice, stop, targetKandidaten, minRr)
    const risk = entryPrice - stop
    const reward = target - entryPrice
    const rewardRisk = risk > 0 ? runde2(reward / risk) : 0

    return {
      entryPrice: runde4(entryPrice),
      stopPrice: stop,
      targetPrice: target,
      stopAbstandPct: runde2((risk / entryPrice) * 100),
      richtung,
      stopBasis,
      targetBasis,
      rewardRisk,
    }
  }

  const strukturKandidaten: Array<{ preis: number; label: string }> = []
  if (react) strukturKandidaten.push({ preis: react.high, label: 'Reaktionsbar-Hoch' })
  if (swingHigh != null) strukturKandidaten.push({ preis: swingHigh, label: 'Swing-Hoch ' + SWING_LOOKBACK + 'T' })
  if (high20 != null) strukturKandidaten.push({ preis: high20, label: '20T-Hoch' })
  if (bar.high > entryPrice) strukturKandidaten.push({ preis: bar.high, label: 'Tages-Hoch' })
  if (prev && prev.high > entryPrice) strukturKandidaten.push({ preis: prev.high, label: 'Vortages-Hoch' })
  if (ma20 != null && ma20 > entryPrice) strukturKandidaten.push({ preis: ma20, label: 'MA20' })
  if (ma50 != null && ma50 > entryPrice) strukturKandidaten.push({ preis: ma50, label: 'MA50' })
  if (bb?.upper != null && bb.upper > entryPrice) {
    strukturKandidaten.push({ preis: bb.upper, label: 'Bollinger oben' })
  }

  const ueberEntry = strukturKandidaten.filter((k) => k.preis > entryPrice)
  let strukturStop: number
  let stopLabel: string
  if (ueberEntry.length > 0) {
    const best = ueberEntry.sort((a, b) => a.preis - b.preis)[0]!
    strukturStop = best.preis + puffer
    stopLabel = best.label + ' + ATR-Puffer'
  } else {
    strukturStop = entryPrice + atr * ATR_STOP_FAKTOR
    stopLabel = 'ATR-Fallback'
  }

  const { stop, basis: clampBasis } = clampStopShort(entryPrice, strukturStop, atr)
  const stopBasis = stopLabel + (clampBasis !== 'Struktur' ? ' · ' + clampBasis : '')

  const targetKandidaten: Array<{ preis: number; label: string }> = []
  if (low20 != null && low20 < entryPrice) targetKandidaten.push({ preis: low20, label: '20T-Tief' })
  if (swingLow != null && swingLow < entryPrice) targetKandidaten.push({ preis: swingLow, label: 'Swing-Tief' })
  if (bb?.lower != null && bb.lower < entryPrice) {
    targetKandidaten.push({ preis: bb.lower, label: 'Bollinger unten' })
  }
  if (ma20 != null && ma20 < entryPrice && tech?.downtrend) {
    targetKandidaten.push({ preis: ma20 - atr, label: 'MA20-Erweiterung' })
  }

  const { target, basis: targetBasis } = waehleTargetShort(entryPrice, stop, targetKandidaten, minRr)
  const risk = stop - entryPrice
  const reward = entryPrice - target
  const rewardRisk = risk > 0 ? runde2(reward / risk) : 0

  return {
    entryPrice: runde4(entryPrice),
    stopPrice: stop,
    targetPrice: target,
    stopAbstandPct: runde2((risk / entryPrice) * 100),
    richtung,
    stopBasis,
    targetBasis,
    rewardRisk,
  }
}
