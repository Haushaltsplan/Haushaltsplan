/** Schlaf-Schätzung aus IMU-Ruhe + Nachtfenster (ohne WHOOP-Cloud). */

import type { FitnessHistoryState } from '@/lib/fitnessdaten/types'

type MotionSample = { t: number; magnitude: number }

const MAX_SAMPLES = 8000
const motionRing: MotionSample[] = []
let sleepMinutesAccum = 0
let lastSleepTick = 0

export function registriereMotion(ts: number, accel: { x: number; y: number; z: number }): void {
  const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2)
  if (!Number.isFinite(magnitude)) return
  motionRing.push({ t: ts, magnitude })
  if (motionRing.length > MAX_SAMPLES) motionRing.shift()
}

function istNachtfenster(date = new Date()): boolean {
  const h = date.getHours()
  return h >= 22 || h < 8
}

function bewegungsVarianz(windowMs = 120_000): number {
  const now = Date.now()
  const recent = motionRing.filter((s) => now - s.t < windowMs)
  if (recent.length < 10) return 999
  const avg = recent.reduce((a, s) => a + s.magnitude, 0) / recent.length
  const varSum = recent.reduce((a, s) => a + (s.magnitude - avg) ** 2, 0) / recent.length
  return Math.sqrt(varSum)
}

/** Ruhe am Handgelenk ≈ Schlaf (grob). */
export function aktualisiereSchlafSchaetzung(): { sleepMinutes: number; sleepScore: number; efficiency: number } {
  const now = Date.now()
  if (istNachtfenster() && bewegungsVarianz() < 0.08) {
    if (lastSleepTick > 0) {
      sleepMinutesAccum += Math.min(2, (now - lastSleepTick) / 60_000)
    }
    lastSleepTick = now
  } else {
    lastSleepTick = 0
  }

  const sleepMinutes = Math.round(sleepMinutesAccum)
  const target = 480
  const durationScore = Math.min(100, (sleepMinutes / target) * 100)
  const efficiency = bewegungsVarianz() < 0.15 ? 92 : bewegungsVarianz() < 0.25 ? 78 : 65
  const sleepScore = Math.round(Math.min(100, durationScore * 0.6 + efficiency * 0.4))

  return { sleepMinutes, sleepScore, efficiency }
}

export function ladeSchlafAusHistory(history: FitnessHistoryState): {
  sleepMinutes: number
  sleepScore: number
} {
  return aktualisiereSchlafSchaetzung()
}

export function setzeSchlafZurueck(): void {
  sleepMinutesAccum = 0
  lastSleepTick = 0
  motionRing.length = 0
}
