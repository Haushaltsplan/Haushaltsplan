/** Strava — Typen & Hilfskonstanten. */

import type { StravaPowerPeaks } from '@/lib/strava/strava-power'

export const STRAVA_SCOPES = 'read,activity:read_all'

export const STRAVA_RAD_SPORT_TYPES = new Set([
  'Ride',
  'VirtualRide',
  'GravelRide',
  'MountainBikeRide',
  'EBikeRide',
  'EMountainBikeRide',
  'Handcycle',
  'Velomobile',
])

export type StravaStoredTokens = {
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  athleteId?: number | null
}

export type StravaHrZoneMinutes = {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

export type StravaActivityRow = {
  strava_id: number
  name: string
  sport_type: string
  type: string | null
  start_date: string
  distance_m: number
  moving_time_s: number
  elapsed_time_s: number | null
  elevation_gain_m: number | null
  average_watts: number | null
  weighted_avg_watts: number | null
  max_watts: number | null
  average_heartrate: number | null
  max_heartrate: number | null
  kilojoules: number | null
  calories_kcal: number | null
  average_speed_kmh: number | null
  device_watts: boolean | null
  power_peaks: StravaPowerPeaks | null
  summary_polyline: string | null
  suffer_score: number | null
  gear_id: number | null
  workout_type: number | null
  hr_zone_minutes: StravaHrZoneMinutes | null
  estimated_tss: number | null
}

export type StravaSeasonGoals = {
  goal_km_year: number | null
  goal_hm_year: number | null
  goal_rides_per_week: number | null
  goal_event_name: string | null
  goal_event_date: string | null
}

export type StravaAthleteProfile = StravaSeasonGoals & {
  omnia_weight_kg: number | null
  ftp: number | null
  max_hr: number | null
  firstname: string | null
  lastname: string | null
}

export type StravaJahresStat = {
  year: number
  rides: number
  km: number
  hours: number
  hm: number
  kcal: number
  avgWatts: number | null
  avgWkg: number | null
}

export type StravaPrKategorie = 'distanz' | 'hoehe' | 'leistung' | 'kalorien' | 'puls' | 'jahr'

export type StravaPersoenlicheBestleistung = {
  key: string
  kategorie: StravaPrKategorie
  label: string
  value: string
  detail?: string
  activityId?: number
  date?: string
}

export type StravaAuswertung = {
  totalRides: number
  totalKm: number
  totalHours: number
  totalHm: number
  totalKcal: number
  jahre: StravaJahresStat[]
  bestleistungen: StravaPersoenlicheBestleistung[]
  wkgMonat: { label: string; wkg: number; rides: number }[]
  recent: StravaActivityRow[]
}

/** Basis-URL für OAuth — feste Env hat Vorrang vor Request-Origin (Vercel/Native). */
export function stravaOAuthBasisUrl(requestOrigin?: string): string {
  const explicit = process.env.STRAVA_REDIRECT_URI?.trim()
  if (explicit) {
    try {
      return new URL(explicit).origin
    } catch {
      /* fallthrough */
    }
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.OMNIA_CAPACITOR_SERVER_URL?.trim() ||
    requestOrigin?.trim() ||
    ''
  ).replace(/\/+$/, '')
}

export function stravaRedirectUri(requestOrigin?: string): string {
  const explicit = process.env.STRAVA_REDIRECT_URI?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const basis = stravaOAuthBasisUrl(requestOrigin)
  if (!basis) throw new Error('Strava Redirect-URI: keine Basis-URL (NEXT_PUBLIC_APP_URL oder Request-Origin).')
  return `${basis}/api/strava/callback`
}

export function stravaCallbackDomain(requestOrigin?: string): string {
  try {
    return new URL(stravaRedirectUri(requestOrigin)).hostname
  } catch {
    return ''
  }
}

export function stravaApiKonfiguriert(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim())
}
