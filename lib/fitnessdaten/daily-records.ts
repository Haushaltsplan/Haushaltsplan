/** Tages-Aggregate für WHOOP-ähnliche Trends (7 / 30 Tage). */

import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import { ergaenzeSchlafDetails } from '@/lib/fitnessdaten/sleep-detail'
import { speichereZonenImTag } from '@/lib/fitnessdaten/healthspan-engine'
import type { FitnessHistoryState, FitnessScores, FitnessSnapshot, HrZoneMinutes } from '@/lib/fitnessdaten/types'

export const FITNESS_DAILY_STORAGE_KEY = 'mein-haushalt:fitnessdaten-daily'

export type WhoopDayRecord = {
  date: string
  recoveryPercent: number | null
  strain: number | null
  sleepScore: number | null
  sleepMinutes: number | null
  sleepEfficiency: number | null
  sleepNeedMinutes: number | null
  bedTimeMs: number | null
  wakeTimeMs: number | null
  remMinutes: number | null
  deepMinutes: number | null
  sleepConsistency: number | null
  hrvRmssd: number | null
  restingHr: number | null
  respiratoryRate: number | null
  skinTempC: number | null
  skinTempDelta: number | null
  calories: number | null
  steps: number | null
  maxHr: number | null
  zoneMin13: number
  zoneMin45: number
  strengthMin: number
  zoneMinutes?: HrZoneMinutes | null
}

export type WhoopActivity = {
  id: string
  label: string
  strain: number
  startMs: number
  endMs: number
}

export type WhoopDailyStore = {
  version: 1
  days: WhoopDayRecord[]
  activitiesToday: WhoopActivity[]
  skinTempBaseline: number | null
}

function defaultStore(): WhoopDailyStore {
  return { version: 1, days: [], activitiesToday: [], skinTempBaseline: null }
}

export function ladeDailyStore(): WhoopDailyStore {
  if (typeof window === 'undefined') return defaultStore()
  try {
    const raw = window.localStorage.getItem(FITNESS_DAILY_STORAGE_KEY)
    if (!raw) return defaultStore()
    const p = JSON.parse(raw) as WhoopDailyStore
    return p.version === 1 ? p : defaultStore()
  } catch {
    return defaultStore()
  }
}

export function speichereDailyStore(store: WhoopDailyStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FITNESS_DAILY_STORAGE_KEY, JSON.stringify(store))
}

function zoneMin13(z: HrZoneMinutes | null | undefined): number {
  if (!z) return 0
  return (z.z1 ?? 0) + (z.z2 ?? 0) + (z.z3 ?? 0)
}

function zoneMin45(z: HrZoneMinutes | null | undefined): number {
  if (!z) return 0
  return (z.z4 ?? 0) + (z.z5 ?? 0)
}

function schaetzeAtemfrequenz(rhr: number | null, baselineRhr: number): number | null {
  if (rhr == null) return null
  const v = 14.7 + (rhr - baselineRhr) * 0.08
  return Math.round(Math.min(20, Math.max(12, v)) * 10) / 10
}

function schaetzeSchritte(calories: number, zoneMin13Val: number): number {
  return Math.round(calories * 6 + zoneMin13Val * 80)
}

function schaetzeKraftzeit(z: HrZoneMinutes | null | undefined): number {
  if (!z) return 0
  return Math.round((z.z4 ?? 0) * 0.3 + (z.z5 ?? 0) * 0.5)
}

export function aktualisiereHeuteAusSnapshot(
  snapshot: FitnessSnapshot,
  history: FitnessHistoryState,
): WhoopDayRecord {
  const heute = heuteIsoLocal()
  const scores = snapshot.scores
  const store = ladeDailyStore()

  if (snapshot.live?.skinTempC != null) {
    if (store.skinTempBaseline == null) store.skinTempBaseline = snapshot.live.skinTempC
    else store.skinTempBaseline = store.skinTempBaseline * 0.98 + snapshot.live.skinTempC * 0.02
  }

  const skinDelta =
    snapshot.live?.skinTempC != null && store.skinTempBaseline != null
      ? Math.round((snapshot.live.skinTempC - store.skinTempBaseline) * 10) / 10
      : null

  const z = scores?.zoneMinutes
  const record: WhoopDayRecord = speichereZonenImTag(
    ergaenzeSchlafDetails(
      {
        date: heute,
        recoveryPercent: scores?.recoveryPercent ?? null,
        strain: scores?.dayStrain ?? scores?.strain ?? null,
        sleepScore: scores?.sleepScore ?? null,
        sleepMinutes: scores?.sleepMinutes ?? null,
        sleepEfficiency: scores?.sleepEfficiency ?? null,
        sleepNeedMinutes: null,
        bedTimeMs: null,
        wakeTimeMs: null,
        remMinutes: null,
        deepMinutes: null,
        sleepConsistency: null,
        hrvRmssd: scores?.hrvRmssdMs ?? null,
        restingHr: scores?.restingHrBpm ?? null,
        respiratoryRate: schaetzeAtemfrequenz(scores?.restingHrBpm ?? null, history.baselines.restingHrBpm),
        skinTempC: snapshot.live?.skinTempC ?? null,
        skinTempDelta: skinDelta,
        calories: scores?.caloriesKcal ?? null,
        steps: schaetzeSchritte(scores?.caloriesKcal ?? 0, zoneMin13(z)),
        maxHr: scores?.maxHrToday ?? null,
        zoneMin13: zoneMin13(z),
        zoneMin45: zoneMin45(z),
        strengthMin: schaetzeKraftzeit(z),
        zoneMinutes: z ? { ...z } : null,
      },
      scores?.dayStrain ?? scores?.strain ?? null,
    ),
    z,
  )

  const idx = store.days.findIndex((d) => d.date === heute)
  if (idx >= 0) store.days[idx] = record
  else store.days.push(record)

  store.days.sort((a, b) => a.date.localeCompare(b.date))
  if (store.days.length > 35) store.days = store.days.slice(-35)

  speichereDailyStore(store)
  return record
}

export function letzte7Tage(): WhoopDayRecord[] {
  const store = ladeDailyStore()
  return store.days.slice(-7)
}

export function baseline30(field: keyof WhoopDayRecord, days = ladeDailyStore().days): number | null {
  const nums = days
    .slice(-30)
    .map((d) => d[field])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

export function schlafdefizit7Tage(): { date: string; defizitMin: number }[] {
  const ziel = 480
  return letzte7Tage().map((d) => ({
    date: d.date,
    defizitMin: Math.max(0, ziel - (d.sleepMinutes ?? 0)),
  }))
}

export function loescheDailyStore(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(FITNESS_DAILY_STORAGE_KEY)
}
