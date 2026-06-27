/** Strava — HF-Zonen aus Stream oder Schätzung. */

import type { StravaHrZoneMinutes } from '@/lib/strava/strava-types'

const ZONE_BOUNDS = [
  { key: 'z1' as const, minPct: 0, maxPct: 60 },
  { key: 'z2' as const, minPct: 60, maxPct: 70 },
  { key: 'z3' as const, minPct: 70, maxPct: 80 },
  { key: 'z4' as const, minPct: 80, maxPct: 90 },
  { key: 'z5' as const, minPct: 90, maxPct: 101 },
]

export function leereHrZonen(): StravaHrZoneMinutes {
  return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
}

function zoneKeyFromPct(pct: number): keyof StravaHrZoneMinutes {
  for (const z of ZONE_BOUNDS) {
    if (pct >= z.minPct && pct < z.maxPct) return z.key
  }
  return 'z5'
}

/** Berechnet Minuten pro Zone aus HF-Stream. */
export function berechneHrZonenAusStream(
  hr: number[],
  timeS: number[],
  maxHr: number,
): StravaHrZoneMinutes | null {
  if (hr.length < 2 || hr.length !== timeS.length || maxHr <= 0) return null
  const out = leereHrZonen()
  for (let i = 1; i < hr.length; i++) {
    const bpm = hr[i]
    if (bpm <= 0) continue
    const dt = Math.max(0, timeS[i] - timeS[i - 1])
    if (dt <= 0) continue
    const key = zoneKeyFromPct((bpm / maxHr) * 100)
    out[key] += dt / 60
  }
  const total = out.z1 + out.z2 + out.z3 + out.z4 + out.z5
  return total > 0 ? out : null
}

/** Schätzung aus Ø-Puls (Fallback wenn kein Stream). */
export function schaetzeHrZonenAusAvg(
  avgHr: number,
  movingTimeS: number,
  maxHr: number,
): StravaHrZoneMinutes {
  const out = leereHrZonen()
  const key = zoneKeyFromPct((avgHr / maxHr) * 100)
  out[key] = movingTimeS / 60
  return out
}

export function parseHrZoneMinutes(raw: unknown): StravaHrZoneMinutes | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (k: string) => {
    const v = o[k]
    return v != null && Number.isFinite(Number(v)) ? Number(v) : 0
  }
  const z = { z1: num('z1'), z2: num('z2'), z3: num('z3'), z4: num('z4'), z5: num('z5') }
  const total = z.z1 + z.z2 + z.z3 + z.z4 + z.z5
  return total > 0 ? z : null
}

export function summiereHrZonen(zonen: StravaHrZoneMinutes[]): StravaHrZoneMinutes {
  const out = leereHrZonen()
  for (const z of zonen) {
    out.z1 += z.z1
    out.z2 += z.z2
    out.z3 += z.z3
    out.z4 += z.z4
    out.z5 += z.z5
  }
  return out
}

export { ZONE_BOUNDS }
