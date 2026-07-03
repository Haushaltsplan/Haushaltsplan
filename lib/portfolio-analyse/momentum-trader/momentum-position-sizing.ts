import { ATR_STOP_FAKTOR, REWARD_RISK_RATIO } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { berechneStrukturTradeLevels } from '@/lib/portfolio-analyse/momentum-trader/momentum-trade-levels-server'
import type {
  MomentumBarDaily,
  MomentumRichtung,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumPositionsVorschlag = {
  entryPrice: number
  stopPrice: number
  targetPrice: number
  stopAbstandPct: number
  richtung: MomentumRichtung
  stopBasis?: string
  targetBasis?: string
  rewardRisk?: number
}

export type PositionsVorschlagOpts = {
  bars?: MomentumBarDaily[]
  tech?: MomentumTechSnapshot | null
  barIdx?: number
  reactionBar?: MomentumBarDaily | null
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** Stop/Ziel — bevorzugt Struktur (Kerzen/MA/Range), sonst ATR-Fallback. */
export function berechnePositionsVorschlag(
  entryPrice: number,
  atr: number,
  richtung: MomentumRichtung,
  barsOrOpts?: MomentumBarDaily[] | PositionsVorschlagOpts,
  tech?: MomentumTechSnapshot | null,
  barIdx?: number,
): MomentumPositionsVorschlag | null {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(atr) || atr <= 0) return null

  let bars: MomentumBarDaily[] | undefined
  let reactionBar: MomentumBarDaily | null | undefined
  let techSnap = tech
  let idx = barIdx
  if (Array.isArray(barsOrOpts)) {
    bars = barsOrOpts
  } else if (barsOrOpts) {
    bars = barsOrOpts.bars
    techSnap = barsOrOpts.tech ?? tech
    idx = barsOrOpts.barIdx ?? barIdx
    reactionBar = barsOrOpts.reactionBar
  }

  if (bars && bars.length >= 25) {
    const struktur = berechneStrukturTradeLevels(entryPrice, richtung, bars, {
      atr,
      tech: techSnap,
      barIdx: idx,
      reactionBar,
    })
    if (struktur) return struktur
  }

  const stopDist = atr * ATR_STOP_FAKTOR
  const stopPrice =
    richtung === 'long' ? runde4(entryPrice - stopDist) : runde4(entryPrice + stopDist)
  const targetDist = stopDist * REWARD_RISK_RATIO
  const targetPrice =
    richtung === 'long' ? runde4(entryPrice + targetDist) : runde4(entryPrice - targetDist)
  const stopAbstandPct = Math.round((stopDist / entryPrice) * 10_000) / 100

  return {
    entryPrice: runde4(entryPrice),
    stopPrice,
    targetPrice,
    stopAbstandPct,
    richtung,
    stopBasis: 'ATR × ' + ATR_STOP_FAKTOR + ' (wenig Bars)',
    targetBasis: REWARD_RISK_RATIO + ':1 R/R',
    rewardRisk: REWARD_RISK_RATIO,
  }
}

/** PnL in EUR — 1R = Verlust am Stop (aus CFD-Planung gespeichert). */
export function berechnePnlEur(
  richtung: MomentumRichtung,
  entryPrice: number,
  stopPrice: number,
  exitPrice: number,
  verlustAmStopEur: number,
): number {
  const riskProAnteil = Math.abs(entryPrice - stopPrice)
  if (riskProAnteil <= 0) return 0
  const move = richtung === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  return Math.round((move / riskProAnteil) * verlustAmStopEur * 100) / 100
}
