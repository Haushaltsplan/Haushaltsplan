/**
 * XTB-CFD-Planung: fester Einsatz (Margin) + Hebel 5×.
 * Stop/Ziel kommen vom Setup (ATR) — kein künstliches 10-€-Risiko-Sizing.
 */

import {
  CFD_DEFAULT_MARGIN_EUR,
  CFD_HEBEL_XTB,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'

export type MomentumCfdPlanung = {
  hebel: number
  marginEur: number
  exposureEur: number
  /** Stückzahl / Kontraktvolumen (Exposure ÷ Einstieg). */
  einheiten: number
  /** Verlust in € wenn der technische Stop erreicht wird. */
  verlustAmStopEur: number
  /** Gewinn in € wenn das Ziel erreicht wird. */
  gewinnAmZielEur: number
  stopAbstandPct: number
  zielAbstandPct: number
}

function runde2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Planung aus festem Einsatz: exposure = margin × 5, PnL aus Stop-/Ziel-Abstand.
 * (USD-Preise ≈ EUR — wie bisher im Momentum-Modul.)
 */
export function berechneCfdPlanung(
  entry: number,
  stop: number,
  target: number,
  marginEur = CFD_DEFAULT_MARGIN_EUR,
): MomentumCfdPlanung | null {
  if (!Number.isFinite(entry) || entry <= 0) return null
  if (!Number.isFinite(marginEur) || marginEur <= 0) return null

  const hebel = CFD_HEBEL_XTB
  const exposureEur = marginEur * hebel
  const einheiten = exposureEur / entry
  const stopDist = Math.abs(entry - stop)
  const targetDist = Math.abs(target - entry)
  const stopAbstandPct = entry > 0 ? runde2((stopDist / entry) * 100) : 0
  const zielAbstandPct = entry > 0 ? runde2((targetDist / entry) * 100) : 0

  return {
    hebel,
    marginEur: runde2(marginEur),
    exposureEur: runde2(exposureEur),
    einheiten: runde2(einheiten),
    verlustAmStopEur: runde2(einheiten * stopDist),
    gewinnAmZielEur: runde2(einheiten * targetDist),
    stopAbstandPct,
    zielAbstandPct,
  }
}

/** CFD-Kennzahlen in Scan-Indikatoren einhängen. */
export function cfdIndikatorenAusLevels(
  entry: number | null,
  stop: number | null,
  target: number | null,
  marginEur = CFD_DEFAULT_MARGIN_EUR,
): Record<string, number | null> {
  if (entry == null || stop == null || target == null) {
    return {
      marginEur: marginEur,
      exposureEur: null,
      verlustAmStopEur: null,
      gewinnAmZielEur: null,
      riskEur: null,
    }
  }
  const plan = berechneCfdPlanung(entry, stop, target, marginEur)
  if (!plan) {
    return {
      marginEur: marginEur,
      exposureEur: null,
      verlustAmStopEur: null,
      gewinnAmZielEur: null,
      riskEur: null,
    }
  }
  return {
    marginEur: plan.marginEur,
    exposureEur: plan.exposureEur,
    verlustAmStopEur: plan.verlustAmStopEur,
    gewinnAmZielEur: plan.gewinnAmZielEur,
    riskEur: plan.verlustAmStopEur,
  }
}
