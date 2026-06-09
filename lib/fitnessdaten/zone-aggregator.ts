/** HF-Zonen aus HR-Verlauf, Workouts oder Cloud-Durchschnitt ableiten. */

import type { WhoopActivity } from '@/lib/fitnessdaten/daily-records'
import { leereZonen, sekundenZuMinuten, zoneFuerBpm } from '@/lib/fitnessdaten/scores'
import type { FitnessHrPoint, HrZoneMinutes } from '@/lib/fitnessdaten/types'

export function zonenAusHrPunkten(
  points: FitnessHrPoint[],
  maxHr: number,
  restingHr: number,
): HrZoneMinutes {
  if (points.length < 2) return sekundenZuMinuten(leereZonen())
  const seconds = leereZonen()
  const sorted = [...points].sort((a, b) => a.t - b.t)
  for (let i = 1; i < sorted.length; i++) {
    const dt = Math.min(300, Math.max(1, (sorted[i]!.t - sorted[i - 1]!.t) / 1000))
    const zone = zoneFuerBpm(sorted[i]!.bpm, maxHr, restingHr)
    seconds[zone] += dt
  }
  return sekundenZuMinuten(seconds)
}

export function zonenAusWorkouts(
  activities: WhoopActivity[],
  restingHr: number,
  maxHr: number,
): HrZoneMinutes {
  const seconds = leereZonen()
  for (const a of activities) {
    const durSec = Math.max(0, (a.endMs - a.startMs) / 1000)
    if (durSec < 60) continue
    const avg = a.avgHr ?? restingHr + 25
    const zone = zoneFuerBpm(avg, maxHr, restingHr)
    seconds[zone] += durSec
  }
  return sekundenZuMinuten(seconds)
}

/** Näherung für Cloud-Tage ohne BLE: Zyklus-Ø-HF + Strain → Zonenanteile. */
export function zonenAusZyklus(
  avgHr: number | null,
  strain: number | null,
  restingHr: number,
  maxHr: number,
): HrZoneMinutes {
  const seconds = leereZonen()
  if (avgHr == null || strain == null || strain <= 0) return sekundenZuMinuten(seconds)
  const activeMin = Math.round(Math.min(480, strain * 18 + 20))
  const zone = zoneFuerBpm(avgHr, maxHr, restingHr)
  seconds[zone] += activeMin * 60
  if (zone === 'z1' || zone === 'z2') {
    seconds.z1 += Math.round(activeMin * 0.35 * 60)
    seconds.z2 += Math.round(activeMin * 0.25 * 60)
  }
  return sekundenZuMinuten(seconds)
}

function minutenZuSekunden(z: HrZoneMinutes): HrZoneMinutes {
  const out = leereZonen()
  for (const k of Object.keys(out) as (keyof HrZoneMinutes)[]) {
    out[k] = (z[k] ?? 0) * 60
  }
  return out
}

/** Kombiniert mehrere Zonen-Quellen (nimmt Maximum pro Zone). */
export function mergeZonen(...sources: (HrZoneMinutes | null | undefined)[]): HrZoneMinutes {
  const merged = leereZonen()
  for (const src of sources) {
    if (!src) continue
    const sec = minutenZuSekunden(src)
    for (const k of Object.keys(merged) as (keyof HrZoneMinutes)[]) {
      merged[k] = Math.max(merged[k], sec[k])
    }
  }
  return sekundenZuMinuten(merged)
}
