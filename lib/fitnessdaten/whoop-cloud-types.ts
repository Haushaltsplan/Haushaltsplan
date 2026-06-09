/** WHOOP Cloud — geteilte Typen (Client + Server). */

export type WhoopCloudRecoveryRow = {
  date: string
  spo2Percent: number | null
  skinTempC: number | null
  recoveryPercent: number | null
  hrvRmssd: number | null
  restingHr: number | null
}

export type WhoopCloudSleepRow = {
  date: string
  sleepScore: number | null
  sleepEfficiency: number | null
  sleepConsistency: number | null
  sleepMinutes: number | null
  sleepNeedMinutes: number | null
  remMinutes: number | null
  deepMinutes: number | null
  lightMinutes: number | null
  awakeMinutes: number | null
  respiratoryRate: number | null
  bedTimeMs: number | null
  wakeTimeMs: number | null
}

export type WhoopCloudCycleRow = {
  date: string
  strain: number | null
  avgHr: number | null
  maxHr: number | null
  calories: number | null
}

export type WhoopCloudWorkoutRow = {
  id: string
  date: string
  label: string
  sport: string | null
  strain: number
  startMs: number
  endMs: number
  avgHr: number | null
  maxHr: number | null
  calories: number | null
}

export type WhoopCloudBodyMeasurements = {
  heightCm: number | null
  weightKg: number | null
  maxHr: number | null
}

export type WhoopBffDailyRow = {
  date: string
  steps?: number | null
  calories?: number | null
  avgHr?: number | null
  restingHr?: number | null
  hrvRmssd?: number | null
  respiratoryRate?: number | null
  vo2Max?: number | null
}

export type WhoopBffMonthlyAvgs = {
  steps: number | null
  calories: number | null
  rhr: number | null
  avgHr: number | null
  hrv: number | null
  respiratory: number | null
  vo2Max: number | null
}

export type WhoopBffSyncPayload = {
  daily: WhoopBffDailyRow[]
  monthlyAvgs: WhoopBffMonthlyAvgs
  syncedAt: string
}

export type WhoopCloudSyncPayload = {
  recoveries: WhoopCloudRecoveryRow[]
  sleeps: WhoopCloudSleepRow[]
  cycles: WhoopCloudCycleRow[]
  workouts: WhoopCloudWorkoutRow[]
  body: WhoopCloudBodyMeasurements | null
  bff?: WhoopBffSyncPayload | null
}

export type WhoopCloudSyncResult = {
  ok: boolean
  payload?: WhoopCloudSyncPayload
  syncedAt: string
  message: string
  fehler?: string
  stats?: {
    recoveries: number
    sleeps: number
    cycles: number
    workouts: number
    mitSpo2: number
  }
}

export const WHOOP_OAUTH_COOKIE = 'mh_whoop_oauth'
export const WHOOP_OAUTH_STATE_COOKIE = 'mh_whoop_oauth_state'

export const WHOOP_SCOPES = [
  'offline',
  'read:recovery',
  'read:cycles',
  'read:sleep',
  'read:workout',
  'read:profile',
  'read:body_measurement',
].join(' ')

export function whoopRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/api/fitnessdaten/whoop/callback`
}

export function whoopApiKonfiguriert(): boolean {
  return Boolean(process.env.WHOOP_CLIENT_ID?.trim() && process.env.WHOOP_CLIENT_SECRET?.trim())
}
