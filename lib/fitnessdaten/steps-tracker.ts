/** Schritte aus IMU-Beschleunigung (WHOOP-Band Gen5). */

import { ladeCalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'

let letzterPeak = 0
let letzterSchrittTs = 0

let letzterMag = 0
let steigend = false

export function zaehleSchrittAusAccel(
  accel: { x: number; y: number; z: number },
  ts: number,
): boolean {
  const p = ladeCalibrationParams()
  const sens = Math.max(0.5, p.stepsSensitivity)
  const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2)
  if (!Number.isFinite(mag) || mag < 0.4 / sens || mag > 5 * sens) {
    return false
  }

  if (mag > letzterMag + 0.04 / sens) steigend = true
  if (steigend && mag < letzterMag - 0.06 / sens) {
    steigend = false
    const peakLo = 0.92 / sens
    const peakHi = 1.45 * sens
    if (letzterPeak > peakLo && letzterPeak < peakHi && ts - letzterSchrittTs > 320 / sens) {
      letzterSchrittTs = ts
      letzterPeak = mag
      letzterMag = mag
      return true
    }
  }

  if (mag > letzterPeak) letzterPeak = mag
  letzterMag = mag
  return false
}

/** Skaliert Roh-Schrittzähler mit Kalibrierungsfaktor. */
export function skaliereSchritte(rawSteps: number): number {
  const p = ladeCalibrationParams()
  return Math.max(0, Math.round(rawSteps * p.stepsScale))
}

export function resetSchrittTracker(): void {
  letzterPeak = 0
  letzterSchrittTs = 0
  letzterMag = 0
  steigend = false
}
