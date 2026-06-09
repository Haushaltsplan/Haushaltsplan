/** Tages-Aggregate für WHOOP-ähnliche Trends (7 / 30 Tage). */

import { heuteIsoLocal, istMorgenFenster, mergeTagesStrain } from '@/lib/fitnessdaten/scores'
import { ergaenzeSchlafDetails } from '@/lib/fitnessdaten/sleep-detail'
import { speichereZonenImTag } from '@/lib/fitnessdaten/healthspan-engine'
import { mergeTagesSchritte, schritteHeuteAusDaily } from '@/lib/fitnessdaten/steps-engine'
import { aktualisiereVo2MaxWennFaellig } from '@/lib/fitnessdaten/vo2max-engine'
import {
  mergeZonen,
  zonenAusHrPunkten,
  zonenAusWorkouts,
  zonenAusZyklus,
} from '@/lib/fitnessdaten/zone-aggregator'
import type { FitnessHistoryState, FitnessScores, FitnessSnapshot, HrZoneMinutes } from '@/lib/fitnessdaten/types'
import { profilAlter, ladeFitnessProfil, profilMaxHr } from '@/lib/fitnessdaten/user-profile'

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
  lightMinutes: number | null
  awakeMinutes: number | null
  sleepConsistency: number | null
  hrvRmssd: number | null
  restingHr: number | null
  avgHr: number | null
  respiratoryRate: number | null
  skinTempC: number | null
  skinTempDelta: number | null
  spo2Percent: number | null
  bpSystolic: number | null
  bpDiastolic: number | null
  calories: number | null
  steps: number | null
  vo2Max: number | null
  maxHr: number | null
  zoneMin13: number
  zoneMin45: number
  strengthMin: number
  zoneMinutes?: HrZoneMinutes | null
  /** true = Erholung für heute fest (WHOOP Cloud oder Morgen-Messung) */
  recoveryLocked?: boolean
}

export type WhoopActivity = {
  id: string
  label: string
  strain: number
  startMs: number
  endMs: number
  date?: string
  sport?: string | null
  avgHr?: number | null
  maxHr?: number | null
  calories?: number | null
}

export type WhoopJournalEntry = {
  date: string
  question: string
  answer: string
}

export type VitalLogEntry = {
  id: string
  date: string
  recordedAt: string
  bpSystolic: number | null
  bpDiastolic: number | null
  spo2Manual: number | null
  note: string | null
}

export type WhoopDailyStore = {
  version: 2
  days: WhoopDayRecord[]
  /** Legacy — BLE-erkannte Aktivitäten heute */
  activitiesToday: WhoopActivity[]
  /** Workouts aus Cloud/CSV */
  activities: WhoopActivity[]
  journal: WhoopJournalEntry[]
  vitals: VitalLogEntry[]
  skinTempBaseline: number | null
}

export function createEmptyDayRecord(date: string): WhoopDayRecord {
  return {
    date,
    recoveryPercent: null,
    strain: null,
    sleepScore: null,
    sleepMinutes: null,
    sleepEfficiency: null,
    sleepNeedMinutes: null,
    bedTimeMs: null,
    wakeTimeMs: null,
    remMinutes: null,
    deepMinutes: null,
    lightMinutes: null,
    awakeMinutes: null,
    sleepConsistency: null,
    hrvRmssd: null,
    restingHr: null,
    avgHr: null,
    respiratoryRate: null,
    skinTempC: null,
    skinTempDelta: null,
    spo2Percent: null,
    bpSystolic: null,
    bpDiastolic: null,
    calories: null,
    steps: null,
    vo2Max: null,
    maxHr: null,
    zoneMin13: 0,
    zoneMin45: 0,
    strengthMin: 0,
    zoneMinutes: null,
  }
}

function defaultStore(): WhoopDailyStore {
  return { version: 2, days: [], activitiesToday: [], activities: [], journal: [], vitals: [], skinTempBaseline: null }
}

function normalizeDay(d: WhoopDayRecord): WhoopDayRecord {
  return { ...createEmptyDayRecord(d.date), ...d, date: d.date }
}

function migrateStore(raw: unknown): WhoopDailyStore {
  if (!raw || typeof raw !== 'object') return defaultStore()
  const o = raw as Record<string, unknown>
  if (o.version === 2) {
    const s = o as WhoopDailyStore
    return {
      version: 2,
      days: (s.days ?? []).map(normalizeDay),
      activitiesToday: s.activitiesToday ?? [],
      activities: s.activities ?? [],
      journal: s.journal ?? [],
      vitals: s.vitals ?? [],
      skinTempBaseline: s.skinTempBaseline ?? null,
    }
  }
  if (o.version === 1) {
    return {
      version: 2,
      days: ((o.days as WhoopDayRecord[]) ?? []).map(normalizeDay),
      activitiesToday: (o.activitiesToday as WhoopActivity[]) ?? [],
      activities: [],
      journal: [],
      vitals: [],
      skinTempBaseline: (o.skinTempBaseline as number | null) ?? null,
    }
  }
  return defaultStore()
}

export function ladeDailyStore(): WhoopDailyStore {
  if (typeof window === 'undefined') return defaultStore()
  try {
    const raw = window.localStorage.getItem(FITNESS_DAILY_STORAGE_KEY)
    if (!raw) return defaultStore()
    return migrateStore(JSON.parse(raw))
  } catch {
    return defaultStore()
  }
}

export function speichereDailyStore(store: WhoopDailyStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FITNESS_DAILY_STORAGE_KEY, JSON.stringify({ ...store, version: 2 }))
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

function schaetzeKraftzeit(z: HrZoneMinutes | null | undefined): number {
  if (!z) return 0
  return Math.round((z.z4 ?? 0) * 0.3 + (z.z5 ?? 0) * 0.5)
}

export function aktivitaetenFuerDatum(date: string, store = ladeDailyStore()): WhoopActivity[] {
  return store.activities.filter((a) => (a.date ?? isoAusMs(a.startMs)) === date)
}

export function journalFuerDatum(date: string, store = ladeDailyStore()): WhoopJournalEntry[] {
  return store.journal.filter((j) => j.date === date)
}

export function vitalFuerDatum(date: string, store = ladeDailyStore()): VitalLogEntry[] {
  return store.vitals.filter((v) => v.date === date)
}

export function isoAusMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mergeKalorien(
  live: number | null | undefined,
  prev: number | null,
  historyToday: number,
): number | null {
  const kandidaten = [prev, live, historyToday > 0 ? historyToday : null].filter(
    (v): v is number => v != null && v > 0,
  )
  if (kandidaten.length === 0) return prev
  return Math.round(Math.max(...kandidaten))
}

export function ergaenzeZonenUndVitals(
  record: WhoopDayRecord,
  history: FitnessHistoryState,
  store = ladeDailyStore(),
): WhoopDayRecord {
  const rhr = record.restingHr ?? history.baselines.restingHrBpm
  const maxHr = record.maxHr ?? profilMaxHr(ladeFitnessProfil())
  const hrPoints = history.hrSeries.filter(
    (p) => new Date(p.t).toISOString().slice(0, 10) === record.date,
  )
  const acts = store.activities.filter((a) => (a.date ?? isoAusMs(a.startMs)) === record.date)
  const zBle = hrPoints.length >= 5 ? zonenAusHrPunkten(hrPoints, maxHr, rhr) : null
  const zWork = acts.length > 0 ? zonenAusWorkouts(acts, rhr, maxHr) : null
  const zCloud =
    record.zoneMin13 <= 0 && record.avgHr != null
      ? zonenAusZyklus(record.avgHr, record.strain, rhr, maxHr)
      : null
  const z = mergeZonen(record.zoneMinutes ?? undefined, zBle, zWork, zCloud)
  const vo2Trends = aktualisiereVo2MaxWennFaellig()
  const avgHr =
    record.avgHr ??
    (hrPoints.length >= 3
      ? Math.round(hrPoints.reduce((a, p) => a + p.bpm, 0) / hrPoints.length)
      : null)
  return speichereZonenImTag(
    {
      ...record,
      avgHr,
      vo2Max: vo2Trends.manuell ?? vo2Trends.vo2Max ?? record.vo2Max,
      steps: mergeTagesSchritte(
        record.steps,
        record.date === heuteIsoLocal() ? schritteHeuteAusDaily() : 0,
        record.strain,
        (z.z1 ?? 0) + (z.z2 ?? 0) + (z.z3 ?? 0),
        record.avgHr,
        rhr,
      ),
      zoneMinutes: z,
      zoneMin13: (z.z1 ?? 0) + (z.z2 ?? 0) + (z.z3 ?? 0),
      zoneMin45: (z.z4 ?? 0) + (z.z5 ?? 0),
      strengthMin: schaetzeKraftzeit(z),
    },
    z,
  )
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
  const prevHeute = store.days.find((d) => d.date === heute) ?? createEmptyDayRecord(heute)

  const liveRecovery = scores?.recoveryPercent ?? null
  let recoveryPercent = prevHeute.recoveryPercent
  let recoveryLocked = prevHeute.recoveryLocked ?? false
  if (recoveryLocked && prevHeute.recoveryPercent != null) {
    recoveryPercent = prevHeute.recoveryPercent
  } else if (liveRecovery != null && liveRecovery > 0 && istMorgenFenster()) {
    recoveryPercent = Math.round(liveRecovery)
    recoveryLocked = true
  } else if (liveRecovery != null && prevHeute.recoveryPercent == null && istMorgenFenster()) {
    recoveryPercent = Math.round(liveRecovery)
    recoveryLocked = true
  }

  const liveStrain = scores?.dayStrain ?? scores?.strain ?? null
  const strain = mergeTagesStrain(liveStrain, prevHeute.strain)

  const record: WhoopDayRecord = speichereZonenImTag(
    ergaenzeSchlafDetails(
      {
        ...prevHeute,
        date: heute,
        recoveryPercent,
        recoveryLocked,
        strain,
        sleepScore: scores?.sleepScore ?? prevHeute.sleepScore,
        sleepMinutes: scores?.sleepMinutes ?? prevHeute.sleepMinutes,
        sleepEfficiency: scores?.sleepEfficiency ?? prevHeute.sleepEfficiency,
        hrvRmssd: scores?.hrvRmssdMs ?? prevHeute.hrvRmssd,
        restingHr: scores?.restingHrBpm ?? prevHeute.restingHr,
        respiratoryRate:
          prevHeute.respiratoryRate ??
          schaetzeAtemfrequenz(scores?.restingHrBpm ?? null, history.baselines.restingHrBpm),
        skinTempC: snapshot.live?.skinTempC ?? prevHeute.skinTempC,
        skinTempDelta: skinDelta ?? prevHeute.skinTempDelta,
        calories: mergeKalorien(scores?.caloriesKcal, prevHeute.calories, history.caloriesToday),
        steps: mergeTagesSchritte(
          prevHeute.steps,
          Math.max(history.stepsToday ?? 0, schritteHeuteAusDaily()),
          strain,
          zoneMin13(z),
          scores?.avgHrSession ?? prevHeute.avgHr,
          scores?.restingHrBpm ?? prevHeute.restingHr ?? history.baselines.restingHrBpm,
        ),
        maxHr: scores?.maxHrToday ?? prevHeute.maxHr,
        avgHr: scores?.avgHrSession ?? prevHeute.avgHr,
        zoneMin13: zoneMin13(z),
        zoneMin45: zoneMin45(z),
        strengthMin: schaetzeKraftzeit(z),
        zoneMinutes: z ? { ...z } : prevHeute.zoneMinutes,
      },
      strain,
    ),
    z,
  )

  const recordFinal = ergaenzeZonenUndVitals(record, history, store)

  const idx = store.days.findIndex((d) => d.date === heute)
  if (idx >= 0) store.days[idx] = recordFinal
  else store.days.push(recordFinal)

  store.days.sort((a, b) => a.date.localeCompare(b.date))
  if (store.days.length > 365) store.days = store.days.slice(-365)

  speichereDailyStore(store)
  return recordFinal
}

export function aktivitaetenLetzteTage(tage = 14, store = ladeDailyStore()): WhoopActivity[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - tage)
  const cutoffMs = cutoff.getTime()
  return [...store.activities, ...store.activitiesToday]
    .filter((a) => a.startMs >= cutoffMs)
    .sort((a, b) => b.startMs - a.startMs)
    .slice(0, 40)
}

export function letzte7Tage(): WhoopDayRecord[] {
  return ladeDailyStore().days.slice(-7)
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
    defizitMin: Math.max(0, (d.sleepNeedMinutes ?? ziel) - (d.sleepMinutes ?? 0)),
  }))
}

export function loescheDailyStore(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(FITNESS_DAILY_STORAGE_KEY)
}
