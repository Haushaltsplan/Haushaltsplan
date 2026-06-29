import {
  ATR_STOP_FAKTOR,
  MOMENTUM_DEFAULT_RISK_EUR,
  REWARD_RISK_RATIO,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type { MomentumRichtung } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export type MomentumPositionsVorschlag = {
  entryPrice: number
  stopPrice: number
  targetPrice: number
  stopAbstandPct: number
  riskEur: number
  richtung: MomentumRichtung
}

function runde4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** Stop/Ziel aus ATR — Risiko fix in EUR (Standard 10 €). */
export function berechnePositionsVorschlag(
  entryPrice: number,
  atr: number,
  richtung: MomentumRichtung,
  riskEur = MOMENTUM_DEFAULT_RISK_EUR,
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
    riskEur,
    richtung,
  }
}

/** PnL in EUR aus Entry/Stop/Exit (proportional zum definierten Risiko). */
export function berechnePnlEur(
  richtung: MomentumRichtung,
  entryPrice: number,
  stopPrice: number,
  exitPrice: number,
  riskEur: number,
): number {
  const riskProAnteil = Math.abs(entryPrice - stopPrice)
  if (riskProAnteil <= 0) return 0
  const move = richtung === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  return Math.round((move / riskProAnteil) * riskEur * 100) / 100
}
