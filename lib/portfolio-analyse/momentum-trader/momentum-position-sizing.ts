import { ATR_STOP_FAKTOR, REWARD_RISK_RATIO } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type { MomentumRichtung } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumPositionsVorschlag = {
  entryPrice: number
  stopPrice: number
  targetPrice: number
  stopAbstandPct: number
  richtung: MomentumRichtung
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** Stop/Ziel aus ATR — technische Levels, kein €-Risiko-Sizing. */
export function berechnePositionsVorschlag(
  entryPrice: number,
  atr: number,
  richtung: MomentumRichtung,
): MomentumPositionsVorschlag | null {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(atr) || atr <= 0) return null

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
