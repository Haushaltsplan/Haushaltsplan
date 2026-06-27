/** Strava — Power-Curve & eFTP-Schätzung. */

import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import { POWER_PEAK_LABELS, type StravaPowerPeaks } from '@/lib/strava/strava-power'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type PowerCurvePoint = {
  key: keyof StravaPowerPeaks
  label: string
  seconds: number
  bestWatts: number | null
  bestWkg: number | null
  activityId: number | null
  activityName: string | null
}

const PEAK_SECONDS: Record<keyof StravaPowerPeaks, number> = {
  max_1s: 1,
  avg_5s: 5,
  avg_1min: 60,
  avg_5min: 300,
  avg_20min: 1200,
  avg_60min: 3600,
}

const PEAK_KEYS: (keyof StravaPowerPeaks)[] = [
  'max_1s',
  'avg_5s',
  'avg_1min',
  'avg_5min',
  'avg_20min',
  'avg_60min',
]

export function berechnePowerCurve(
  activities: StravaActivityRow[],
  weightKg: number | null,
): PowerCurvePoint[] {
  const rides = activities.filter(istRadAktivitaet)

  return PEAK_KEYS.map((key) => {
    let bestW: number | null = null
    let bestA: StravaActivityRow | null = null
    for (const a of rides) {
      const peaks = a.power_peaks
      if (!peaks) continue
      const w = peaks[key]
      if (w != null && w > 0 && (bestW == null || w > bestW)) {
        bestW = w
        bestA = a
      }
    }
    const bestWkg =
      bestW != null && weightKg != null && weightKg > 0 ? bestW / weightKg : null
    return {
      key,
      label: POWER_PEAK_LABELS[key],
      seconds: PEAK_SECONDS[key],
      bestWatts: bestW,
      bestWkg: bestWkg != null ? Math.round(bestWkg * 100) / 100 : null,
      activityId: bestA?.strava_id ?? null,
      activityName: bestA?.name ?? null,
    }
  })
}

/** eFTP aus bestem 20-min oder 60-min Peak (× 0,95). */
export function schaetzeEftp(curve: PowerCurvePoint[]): number | null {
  const p20 = curve.find((p) => p.key === 'avg_20min')?.bestWatts
  const p60 = curve.find((p) => p.key === 'avg_60min')?.bestWatts
  if (p20 != null && p20 > 0) return Math.round(p20 * 0.95)
  if (p60 != null && p60 > 0) return Math.round(p60 * 0.95)
  const p5 = curve.find((p) => p.key === 'avg_5min')?.bestWatts
  if (p5 != null && p5 > 0) return Math.round(p5 * 0.85)
  return null
}
