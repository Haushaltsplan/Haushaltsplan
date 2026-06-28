/** Client-Hilfen für Aktivitäten-Sortierung. */

import { transformActivities, type TransformedStravaActivity } from '@/lib/strava/strava-activity-utils'
import { leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type ActivitySortKey =
  | 'date'
  | 'distance'
  | 'time'
  | 'watts'
  | 'wkg'
  | 'elevation'
  | 'tss'

export function sortActivities(
  activities: StravaActivityRow[],
  key: ActivitySortKey,
  desc = true,
  weightKg: number | null = null,
): StravaActivityRow[] {
  const sorted = [...activities].sort((a, b) => {
    let va = 0
    let vb = 0
    switch (key) {
      case 'date':
        va = Date.parse(a.start_date)
        vb = Date.parse(b.start_date)
        break
      case 'distance':
        va = a.distance_m
        vb = b.distance_m
        break
      case 'time':
        va = a.moving_time_s
        vb = b.moving_time_s
        break
      case 'watts':
        va = leistungWatts(a) ?? 0
        vb = leistungWatts(b) ?? 0
        break
      case 'wkg': {
        const wa = leistungWatts(a)
        const wb = leistungWatts(b)
        va = wa != null ? (wattProKg(wa, weightKg) ?? 0) : 0
        vb = wb != null ? (wattProKg(wb, weightKg) ?? 0) : 0
        break
      }
      case 'elevation':
        va = a.elevation_gain_m ?? 0
        vb = b.elevation_gain_m ?? 0
        break
      case 'tss':
        va = a.estimated_tss ?? 0
        vb = b.estimated_tss ?? 0
        break
    }
    return desc ? vb - va : va - vb
  })
  return sorted
}

export function transformSortedFeed(
  activities: StravaActivityRow[],
  key: ActivitySortKey,
  desc: boolean,
  weightKg: number | null = null,
  limit = 50,
): TransformedStravaActivity[] {
  return transformActivities(
    sortActivities(activities, key, desc, weightKg).slice(0, limit),
    weightKg,
  )
}
