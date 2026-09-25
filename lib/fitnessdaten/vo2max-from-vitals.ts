/** VO₂max aus Whoop-Vitalen — rein, ohne localStorage (Server + Client). */

import { DEFAULT_CALIBRATION_PARAMS } from '@/lib/fitnessdaten/calibration/calibration-params'

const MIN_RECOVERY_TAGE = 7

/**
 * WHOOP-VO₂ aus offiziellen Cloud-Vitalen (Developer-API) / lokalen RHR+Max-HF.
 * Uth × Kalibrierungs-Scale (Server: Default; Client kann Scale übergeben).
 */
export function berechneVo2MaxAusWhoopVitals(input: {
  restingHrs: Array<number | null | undefined>
  maxHr: number | null | undefined
  cycleMaxHrs?: Array<number | null | undefined>
  /** Optional: Scale überschreiben (Server: Default 1.0). */
  scale?: number
}): number | null {
  const rhrs = input.restingHrs.filter((v): v is number => v != null && v >= 35 && v <= 100)
  if (rhrs.length < MIN_RECOVERY_TAGE) return null
  const rhr30 = Math.round(rhrs.reduce((a, b) => a + b, 0) / rhrs.length)
  if (rhr30 < 35) return null

  const peaks = (input.cycleMaxHrs ?? [])
    .filter((v): v is number => v != null && v >= 150 && v <= 220)
    .sort((a, b) => a - b)
  const peakMhr =
    peaks.length > 0 ? peaks[Math.min(Math.floor(peaks.length * 0.9), peaks.length - 1)]! : null
  const bodyMhr =
    input.maxHr != null && input.maxHr >= 120 && input.maxHr <= 220 ? Math.round(input.maxHr) : null
  const mhr = bodyMhr ?? peakMhr
  if (mhr == null || mhr <= rhr30) return null

  const scale = input.scale ?? DEFAULT_CALIBRATION_PARAMS.vo2Scale
  return Math.round(Math.min(75, Math.max(28, 15.3 * (mhr / rhr30) * scale)))
}
