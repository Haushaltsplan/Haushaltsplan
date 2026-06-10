/** Strava — Typen & Hilfskonstanten. */

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
}

export type StravaAthleteProfile = {
  weight_kg: number | null
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
  avgWatts: number | null
  avgWkg: number | null
}

export type StravaPersoenlicheBestleistung = {
  key: string
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
  jahre: StravaJahresStat[]
  bestleistungen: StravaPersoenlicheBestleistung[]
  wkgMonat: { label: string; wkg: number; rides: number }[]
  recent: StravaActivityRow[]
}

export function stravaRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/strava/callback`
}

export function stravaApiKonfiguriert(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim())
}
