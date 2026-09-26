/** Schlaf-Schätzung aus IMU-Ruhe + Nachtfenster (ohne WHOOP-Cloud). */

import { ladeCalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'
import type { FitnessHistoryState } from '@/lib/fitnessdaten/types'
import { registriereSchlafFenster } from '@/lib/fitnessdaten/sleep-detail'

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

/** Ruhe am Handgelenk ≈ Schlaf (grob). Score ≈ Whoop Sleep Performance (Dauer/Bedarf). */
export function aktualisiereSchlafSchaetzung(): { sleepMinutes: number; sleepScore: number; efficiency: number } {
  const p = ladeCalibrationParams()
  const now = Date.now()
  if (istNachtfenster() && bewegungsVarianz() < p.sleepStillVariance) {
    if (lastSleepTick > 0) {
      sleepMinutesAccum += Math.min(2, (now - lastSleepTick) / 60_000)
    }
    lastSleepTick = now
    registriereSchlafFenster(true, now)
  } else {
    if (lastSleepTick > 0) registriereSchlafFenster(false, now)
    lastSleepTick = 0
  }

  const sleepMinutes = Math.round(sleepMinutesAccum * p.sleepMinutesScale)
  const target = p.sleepNeedBaseMin || p.sleepTargetMinutes
  // Whoop Sleep Performance ≈ geschlafen / Bedarf
  const durationScore = Math.min(100, (sleepMinutes / Math.max(1, target)) * 100)
  const v = bewegungsVarianz()
  const efficiency = v < 0.15 ? 92 : v < 0.25 ? 78 : 65
  const sleepScore = Math.round(
    Math.min(100, durationScore * p.sleepDurationWeight + efficiency * p.sleepEfficiencyWeight),
  )

  return { sleepMinutes, sleepScore, efficiency }
}

export function ladeSchlafAusHistory(_history: FitnessHistoryState): {
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
