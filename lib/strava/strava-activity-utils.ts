/** Strava — Formatierung & Transformation von Aktivitätsdaten (UI-tauglich). */

import { aktivitaetSpeedKmh } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type StravaSportKind = 'ride' | 'run' | 'other'

export type TransformedStravaActivity = {
  id: number
  name: string
  sportType: string
  kind: StravaSportKind
  startDate: string
  startMs: number
  distanceKm: number
  distanceLabel: string
  movingTimeS: number
  movingTimeLabel: string
  movingTimeCompact: string
  elapsedTimeS: number | null
  elapsedTimeLabel: string | null
  elevationGainM: number | null
  elevationLabel: string
  speedOrPaceLabel: string
  speedOrPaceValue: number | null
  avgHr: number | null
  avgHrLabel: string
  avgWatts: number | null
  wattsLabel: string
  hasPowerMeter: boolean
  stravaUrl: string
}

const RIDE_TYPES = new Set([
  'Ride',
  'VirtualRide',
  'GravelRide',
  'MountainBikeRide',
  'EBikeRide',
  'EMountainBikeRide',
  'Handcycle',
  'Velomobile',
])

const RUN_TYPES = new Set(['Run', 'VirtualRun', 'TrailRun'])

export function sportKind(type: string | null | undefined, sportType?: string): StravaSportKind {
  const t = (sportType || type || '').trim()
  if (RIDE_TYPES.has(t)) return 'ride'
  if (RUN_TYPES.has(t) || t === 'Run') return 'run'
  return 'other'
}

export function formatDistanceKm(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return 'N/A'
  return `${(meters / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export function formatDuration(seconds: number | null | undefined, compact = false): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'N/A'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (compact) {
    if (h > 0) return `${h} h ${m} min`
    if (m > 0) return `${m} min`
    return `${sec} s`
  }
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function msToKmh(metersPerSecond: number | null | undefined): number | null {
  if (metersPerSecond == null || !Number.isFinite(metersPerSecond) || metersPerSecond <= 0) return null
  return metersPerSecond * 3.6
}

/** Pace in Minuten pro Kilometer (Läufer-Standard). */
export function msToPaceMinPerKm(metersPerSecond: number | null | undefined): number | null {
  if (metersPerSecond == null || !Number.isFinite(metersPerSecond) || metersPerSecond <= 0) return null
  return 1000 / (metersPerSecond * 60)
}

export function formatPaceMinPerKm(paceMin: number | null | undefined): string {
  if (paceMin == null || !Number.isFinite(paceMin) || paceMin <= 0) return 'N/A'
  const m = Math.floor(paceMin)
  const s = Math.round((paceMin - m) * 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function formatSpeedKmh(kmh: number | null | undefined): string {
  if (kmh == null || !Number.isFinite(kmh) || kmh <= 0) return 'N/A'
  return `${kmh.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/h`
}

export function formatElevationGain(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return 'N/A'
  return `+${Math.round(meters).toLocaleString('de-DE')} m`
}

export function formatHeartRate(bpm: number | null | undefined): string {
  if (bpm == null || !Number.isFinite(bpm) || bpm <= 0) return 'N/A'
  return `${Math.round(bpm)} bpm`
}

export function formatWatts(watts: number | null | undefined, hasDevice = true): string {
  if (!hasDevice) return 'N/A'
  if (watts == null || !Number.isFinite(watts) || watts <= 0) return 'N/A'
  return `${Math.round(watts)} W`
}

export function speedOrPaceFromActivity(a: StravaActivityRow): { label: string; value: number | null } {
  const kind = sportKind(a.type, a.sport_type)
  const kmh = aktivitaetSpeedKmh(a)
  if (kind === 'run') {
    const pace = kmh != null && kmh > 0 ? 60 / kmh : null
    return { label: formatPaceMinPerKm(pace), value: pace }
  }
  return { label: formatSpeedKmh(kmh), value: kmh }
}

export function transformActivity(a: StravaActivityRow): TransformedStravaActivity {
  const kind = sportKind(a.type, a.sport_type)
  const { label: speedOrPaceLabel, value: speedOrPaceValue } = speedOrPaceFromActivity(a)
  const watts = a.weighted_avg_watts ?? a.average_watts
  const hasPowerMeter = Boolean(a.device_watts)

  return {
    id: a.strava_id,
    name: a.name,
    sportType: a.sport_type || a.type || 'Activity',
    kind,
    startDate: a.start_date,
    startMs: Date.parse(a.start_date),
    distanceKm: a.distance_m / 1000,
    distanceLabel: formatDistanceKm(a.distance_m),
    movingTimeS: a.moving_time_s,
    movingTimeLabel: formatDuration(a.moving_time_s),
    movingTimeCompact: formatDuration(a.moving_time_s, true),
    elapsedTimeS: a.elapsed_time_s,
    elapsedTimeLabel: a.elapsed_time_s != null ? formatDuration(a.elapsed_time_s) : null,
    elevationGainM: a.elevation_gain_m,
    elevationLabel: formatElevationGain(a.elevation_gain_m),
    speedOrPaceLabel,
    speedOrPaceValue,
    avgHr: a.average_heartrate,
    avgHrLabel: formatHeartRate(a.average_heartrate),
    avgWatts: watts,
    wattsLabel: formatWatts(watts, hasPowerMeter),
    hasPowerMeter,
    stravaUrl: `https://www.strava.com/activities/${a.strava_id}`,
  }
}

export function transformActivities(rows: StravaActivityRow[]): TransformedStravaActivity[] {
  return rows.map(transformActivity)
}

/** Relatives Datum auf Deutsch (Heute, Gestern, …). */
export function formatRelativeDate(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const startOfDay = (t: number) => {
    const x = new Date(t)
    x.setHours(0, 0, 0, 0)
    return x.getTime()
  }
  const diffDays = Math.round((startOfDay(now) - startOfDay(d.getTime())) / 86_400_000)
  if (diffDays <= 0) return 'Heute'
  if (diffDays === 1) return 'Gestern'
  if (diffDays < 7) return `Vor ${diffDays} Tagen`
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined })
}

export function sportIcon(kind: StravaSportKind): string {
  switch (kind) {
    case 'ride':
      return '🚴'
    case 'run':
      return '👟'
    default:
      return '⚡'
  }
}

export function sportLabel(kind: StravaSportKind): string {
  switch (kind) {
    case 'ride':
      return 'Ride'
    case 'run':
      return 'Run'
    default:
      return 'Sonstige'
  }
}
