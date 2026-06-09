/** Schritte aus IMU-Beschleunigung (WHOOP-Band Gen5). */

let letzterPeak = 0
let letzterSchrittTs = 0

export function zaehleSchrittAusAccel(
  accel: { x: number; y: number; z: number },
  ts: number,
): boolean {
  const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2)
  if (!Number.isFinite(mag) || mag < 0.5 || mag > 4) {
    letzterPeak = mag
    return false
  }
  const delta = mag - letzterPeak
  letzterPeak = mag
  if (delta < -0.12 && mag < 1.05 && ts - letzterSchrittTs > 280) {
    letzterSchrittTs = ts
    return true
  }
  if (mag > 1.15) letzterPeak = mag
  return false
}

/** WHOOP-ähnliche Schätzung aus Kalorien + moderate Zonenzeit. */
export function schaetzeSchritte(calories: number, zoneMin13Val: number): number {
  if (calories <= 0 && zoneMin13Val <= 0) return 0
  return Math.round(calories * 18 + zoneMin13Val * 95)
}

export function resetSchrittTracker(): void {
  letzterPeak = 0
  letzterSchrittTs = 0
}
