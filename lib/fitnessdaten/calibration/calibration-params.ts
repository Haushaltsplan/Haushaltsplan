/**
 * Kalibrierungs-Parameter — eine zentrale Stelle für alle Offline-Engines.
 * Werden aus Paar-Logs gegen Whoop-Cloud gefittet (solange Abo aktiv).
 */

export type CalibrationParams = {
  version: 1
  /** Strain: Skala nach Banister-Load → 0–21 (Multiplikator auf finalen Strain). */
  strainScale: number
  /** Strain: Log-Basis (höher = flachere Kurve). Whoop-nah ~7201. */
  strainLogBase: number
  /** Strain: τ Ruhe / Belastung (Sekunden). */
  strainTauRestSec: number
  strainTauMaxSec: number

  /** Recovery: Gewicht HRV vs RHR (Summe ≈ 1). */
  recoveryHrvWeight: number
  recoveryRhrWeight: number
  /** Recovery: Multiplikator auf Roh-% vor Clamp. */
  recoveryScale: number

  /** RHR: Anteil niedrigster HF-Samples (0–1). */
  rhrLowPercentile: number

  /** Sleep: Zielminuten für Score 100, Varianz-Schwellen. */
  sleepTargetMinutes: number
  sleepStillVariance: number
  sleepDurationWeight: number
  sleepEfficiencyWeight: number
  /** Sleep-Minuten-Akkumulation Scale (lokal vs Whoop). */
  sleepMinutesScale: number

  /** Schritte: Peak-Schwellen Scale (höher = empfindlicher). */
  stepsSensitivity: number
  stepsScale: number

  /** VO₂: Multiplikator auf Uth-Ergebnis. */
  vo2Scale: number

  /** Kalorien: Multiplikator auf Keytel. */
  caloriesScale: number
}

export const DEFAULT_CALIBRATION_PARAMS: CalibrationParams = {
  version: 1,
  strainScale: 1.05,
  strainLogBase: 7201,
  strainTauRestSec: 4000,
  strainTauMaxSec: 14_400,
  recoveryHrvWeight: 0.68,
  recoveryRhrWeight: 0.32,
  recoveryScale: 1.02,
  rhrLowPercentile: 0.12,
  sleepTargetMinutes: 480,
  sleepStillVariance: 0.08,
  sleepDurationWeight: 0.55,
  sleepEfficiencyWeight: 0.45,
  sleepMinutesScale: 1.0,
  stepsSensitivity: 1.0,
  stepsScale: 1.0,
  vo2Scale: 1.0,
  caloriesScale: 1.08,
}

const STORAGE_KEY = 'mein-haushalt:whoop-calibration-params'

export function ladeCalibrationParams(): CalibrationParams {
  if (typeof window === 'undefined') return { ...DEFAULT_CALIBRATION_PARAMS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CALIBRATION_PARAMS }
    const p = JSON.parse(raw) as Partial<CalibrationParams>
    return { ...DEFAULT_CALIBRATION_PARAMS, ...p, version: 1 }
  } catch {
    return { ...DEFAULT_CALIBRATION_PARAMS }
  }
}

export function speichereCalibrationParams(params: CalibrationParams): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...params, version: 1 }))
}

export function resetCalibrationParams(): CalibrationParams {
  const p = { ...DEFAULT_CALIBRATION_PARAMS }
  speichereCalibrationParams(p)
  return p
}
