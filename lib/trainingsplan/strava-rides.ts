import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'
import type { DaySession, LinkedStravaRide } from '@/lib/trainingsplan/types'

/** Lokales Kalenderdatum aus Strava start_date (UTC/Offset). */
export function stravaLocalDateIso(startDate: string): string {
  const d = new Date(startDate)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toLinkedRide(
  a: StravaActivityRow,
  weightKg: number | null = null,
): LinkedStravaRide {
  const watts = a.weighted_avg_watts ?? a.average_watts
  const wkg =
    watts != null && weightKg != null && weightKg > 0
      ? Math.round((watts / weightKg) * 100) / 100
      : null
  return {
    stravaId: a.strava_id,
    name: a.name,
    distanceKm: Math.round((a.distance_m / 1000) * 10) / 10,
    movingTimeMin: Math.round(a.moving_time_s / 60),
    elevationM: a.elevation_gain_m,
    avgWatts: watts,
    avgWkg: wkg,
    startDateIso: stravaLocalDateIso(a.start_date),
  }
}

export function ridesByDate(
  activities: StravaActivityRow[],
  weightKg: number | null,
): Map<string, LinkedStravaRide[]> {
  const map = new Map<string, LinkedStravaRide[]>()
  for (const a of activities) {
    if (!istRadAktivitaet(a)) continue
    const ride = toLinkedRide(a, weightKg)
    const list = map.get(ride.startDateIso) ?? []
    list.push(ride)
    map.set(ride.startDateIso, list)
  }
  for (const [, list] of map) {
    list.sort((x, y) => y.distanceKm - x.distanceKm)
  }
  return map
}

export function attachStravaToDays(
  days: DaySession[],
  byDate: Map<string, LinkedStravaRide[]>,
): DaySession[] {
  return days.map((d) => {
    const rides = byDate.get(d.dateIso)
    if (!rides?.length) {
      return { ...d, stravaRides: undefined }
    }
    return { ...d, stravaRides: rides }
  })
}

export function sumRideKm(rides: LinkedStravaRide[] | undefined): number {
  if (!rides?.length) return 0
  return Math.round(rides.reduce((s, r) => s + r.distanceKm, 0) * 10) / 10
}
