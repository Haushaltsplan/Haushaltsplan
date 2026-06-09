/** Schritte aus IMU-Beschleunigung (WHOOP-Band Gen5). */

let letzterPeak = 0
let letzterSchrittTs = 0

let letzterMag = 0
let steigend = false

export function zaehleSchrittAusAccel(
  accel: { x: number; y: number; z: number },
  ts: number,
): boolean {
  const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2)
  if (!Number.isFinite(mag) || mag < 0.4 || mag > 5) {
    return false
  }

  if (mag > letzterMag + 0.04) steigend = true
  if (steigend && mag < letzterMag - 0.06) {
    steigend = false
    if (letzterPeak > 0.92 && letzterPeak < 1.45 && ts - letzterSchrittTs > 320) {
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

export function resetSchrittTracker(): void {
  letzterPeak = 0
  letzterSchrittTs = 0
  letzterMag = 0
  steigend = false
}
