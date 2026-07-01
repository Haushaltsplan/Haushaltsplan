/** Lokal berechnete WHOOP-ähnliche Metriken aus BLE-Daten. */

import type { FitnessHrPoint, FitnessScores, HrZoneKey, HrZoneMinutes } from '@/lib/fitnessdaten/types'
import { heuteIsoKalender } from '@/lib/fitnessdaten/iso-date'

export {
  begrenzeStrain,
  strainAusZonen,
  strainAusLoad,
  loadAusStrain,
} from '@/lib/fitnessdaten/strain-engine'

const ZONE_THRESHOLDS: { key: HrZoneKey; minPct: number }[] = [
  { key: 'z5', minPct: 0.9 },
  { key: 'z4', minPct: 0.8 },
  { key: 'z3', minPct: 0.7 },
  { key: 'z2', minPct: 0.6 },
  { key: 'z1', minPct: 0.5 },
  { key: 'rest', minPct: 0 },
]

export function maxHrSchaetzung(age: number): number {
  return Math.round(220 - age)
}

export function zoneFuerBpm(bpm: number, maxHr: number, restingHr = 60): HrZoneKey {
  const reserve = Math.max(maxHr - restingHr, 40)
  const pct = (bpm - restingHr) / reserve
  for (const z of ZONE_THRESHOLDS) {
    if (pct >= z.minPct) return z.key
  }
  return 'rest'
}

export function recoveryAusBaseline(
  hrvRmssd: number | null,
  restingHr: number | null,
  baselineHrv: number,
  baselineRhr: number,
): { percent: number; label: FitnessScores['recoveryLabel'] } | null {
  if (hrvRmssd == null || hrvRmssd <= 0) return null
  const hrvRatio = hrvRmssd / Math.max(baselineHrv, 15)
  const rhrPart =
    restingHr != null && restingHr > 0 ? baselineRhr / restingHr : 1
  const raw = (hrvRatio * 0.72 + rhrPart * 0.28) * 100
  const percent = Math.max(0, Math.min(100, Math.round(raw)))
  let label: FitnessScores['recoveryLabel'] = 'niedrig'
  if (percent >= 67) label = 'optimal'
  else if (percent >= 34) label = 'ausreichend'
  return { percent, label }
}

/** Grobe Kalorienschätzung aus HF (Keytel et al. vereinfacht, kg=75 Default). */
export function kalorienDelta(bpm: number, seconds: number, weightKg = 75, age = 30, male = true): number {
  if (bpm < 40 || seconds <= 0) return 0
  const met =
    male
      ? -55.0969 + 0.6309 * bpm + 0.1988 * weightKg + 0.2017 * age
      : -20.4022 + 0.4472 * bpm - 0.1263 * weightKg + 0.074 * age
  const kcalPerMin = Math.max(0, met) / 60
  return (kcalPerMin * seconds) / 60
}

export function leereZonen(): HrZoneMinutes {
  return { rest: 0, z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
}

export function sekundenZuMinuten(z: HrZoneMinutes): HrZoneMinutes {
  const out = leereZonen()
  for (const k of Object.keys(out) as HrZoneKey[]) {
    out[k] = Math.round((z[k] / 60) * 10) / 10
  }
  return out
}

export function ruhepulsSchaetzung(history: FitnessHrPoint[]): number | null {
  if (history.length < 5) return null
  const sorted = [...history].map((p) => p.bpm).sort((a, b) => a - b)
  const n = Math.max(3, Math.floor(sorted.length * 0.15))
  const low = sorted.slice(0, n)
  return Math.round(low.reduce((a, b) => a + b, 0) / low.length)
}

export function avgHr(history: FitnessHrPoint[]): number | null {
  if (!history.length) return null
  return Math.round(history.reduce((a, p) => a + p.bpm, 0) / history.length)
}

export function maxHr(history: FitnessHrPoint[]): number | null {
  if (!history.length) return null
  return Math.max(...history.map((p) => p.bpm))
}

export function heuteIsoLocal(): string {
  return heuteIsoKalender()
}

/** Erholung nur morgens (nach Aufstehen) — WHOOP-ähnlich 5–14 Uhr. */
export function istMorgenFenster(now = new Date()): boolean {
  const h = now.getHours()
  return h >= 5 && h < 14
}

/**
 * Live-/Cloud-Strain ist der aktuelle Tageswert (kann fallen wie bei WHOOP).
 * Nur bei fehlendem Signal den bisherigen Wert behalten.
 */
export function mergeTagesStrain(
  live: number | null | undefined,
  prev: number | null | undefined,
): number | null {
  const p = prev ?? null
  const l = live ?? null
  if (l == null) return p
  if (l === 0 && p != null && p > 0) return p
  return l
}

export function recoveryLabelAusProzent(percent: number): FitnessScores['recoveryLabel'] {
  if (percent >= 67) return 'optimal'
  if (percent >= 34) return 'ausreichend'
  return 'niedrig'
}
