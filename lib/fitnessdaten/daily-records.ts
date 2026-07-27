/** Tages-Aggregate für WHOOP-ähnliche Trends (7 / 30 Tage). */

import { heuteIsoLocal, istMorgenFenster, mergeTagesStrain } from '@/lib/fitnessdaten/scores'
import { isoAddDaysKalender, isoAusMs } from '@/lib/fitnessdaten/iso-date'
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
import type { LogbuchTagRecord } from '@/lib/fitnessdaten/logbuch'
import { profilAlter, ladeFitnessProfil, profilMaxHr } from '@/lib/fitnessdaten/user-profile'
import {
  befreieLocalStorageQuota,
  istQuotaFehler,
  safeLocalStorageSetItem,
} from '@/lib/local-storage-safe'

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
  /** true = Schritte/Kalorien/Vitals aus WHOOP-App-BFF (nicht überschreiben) */
  bffMetrics?: boolean
  /** true = Strain aus WHOOP Cloud Zyklus-API — lokale BLE-Schätzung nicht überschreiben */
  strainFromCloud?: boolean
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

export type WhoopBffMonthlyAvgs = {
  steps: number | null
  calories: number | null
  rhr: number | null
  avgHr: number | null
  hrv: number | null
  respiratory: number | null
  vo2Max: number | null
}

export type WhoopDailyStore = {
  version: 2
  days: WhoopDayRecord[]
  /** Legacy — BLE-erkannte Aktivitäten heute */
  activitiesToday: WhoopActivity[]
  /** Workouts aus Cloud/CSV */
  activities: WhoopActivity[]
  journal: WhoopJournalEntry[]
  /** Tägliches Verhaltens-Logbuch (Ja/Nein + Details). */
  logbuch: LogbuchTagRecord[]
  vitals: VitalLogEntry[]
  skinTempBaseline: number | null
  /** Monatsdurchschnitte aus WHOOP-App-BFF */
  bffMonthlyAvgs?: WhoopBffMonthlyAvgs | null
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
  return { version: 2, days: [], activitiesToday: [], activities: [], journal: [], logbuch: [], vitals: [], skinTempBaseline: null }
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
      logbuch: s.logbuch ?? [],
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
      logbuch: [],
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

/** Kürzt Historie, damit localStorage nicht volläuft (Charts brauchen ~90 Tage). */
function kuerzeDailyStore(store: WhoopDailyStore, aggressiv = false): WhoopDailyStore {
  const maxDays = aggressiv ? 45 : 120
  const maxActs = aggressiv ? 80 : 250
  const maxJournal = aggressiv ? 40 : 120
  const maxLog = aggressiv ? 40 : 120
  const maxVitals = aggressiv ? 40 : 120
  const days = [...(store.days ?? [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-maxDays)
  const activities = [...(store.activities ?? [])]
    .sort((a, b) => a.startMs - b.startMs)
    .slice(-maxActs)
  return {
    version: 2,
    days,
    activitiesToday: (store.activitiesToday ?? []).slice(-20),
    activities,
    journal: (store.journal ?? []).slice(-maxJournal),
    logbuch: (store.logbuch ?? []).slice(-maxLog),
    vitals: (store.vitals ?? []).slice(-maxVitals),
    skinTempBaseline: store.skinTempBaseline ?? null,
    bffMonthlyAvgs: store.bffMonthlyAvgs ?? null,
  }
}

export function speichereDailyStore(store: WhoopDailyStore): void {
  if (typeof window === 'undefined') return
  let next = kuerzeDailyStore({ ...store, version: 2 }, false)
  const payload = () => JSON.stringify(next)
  if (safeLocalStorageSetItem(FITNESS_DAILY_STORAGE_KEY, payload())) return

  // Noch voll → aggressiver kürzen + große Fremd-Caches löschen
  befreieLocalStorageQuota()
  next = kuerzeDailyStore(next, true)
  if (safeLocalStorageSetItem(FITNESS_DAILY_STORAGE_KEY, payload())) return

  // Notfall: nur letzte 21 Tage, keine Aktivitäten/Journal
  next = {
    version: 2,
    days: next.days.slice(-21),
    activitiesToday: [],
    activities: [],
    journal: [],
    logbuch: [],
    vitals: [],
    skinTempBaseline: next.skinTempBaseline,
    bffMonthlyAvgs: null,
  }
  if (safeLocalStorageSetItem(FITNESS_DAILY_STORAGE_KEY, payload())) return

  try {
    window.localStorage.removeItem(FITNESS_DAILY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Einmalig zu große Stores beim App-Start verkleinern (ohne Throw). */
export function kompaktierenDailyStoreFallsNoetig(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(FITNESS_DAILY_STORAGE_KEY)
    if (!raw) return
    // ~1.5 MB JSON ist riskant; typisches Quota ~5 MB gesamt
    if (raw.length < 800_000) return
    const store = migrateStore(JSON.parse(raw))
    speichereDailyStore(store)
  } catch (err) {
    if (istQuotaFehler(err)) {
      befreieLocalStorageQuota()
      try {
        window.localStorage.removeItem(FITNESS_DAILY_STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }
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

function mergeKalorien(
  live: number | null | undefined,
  prev: number | null,
  historyToday: number,
  bffAutoritativ: boolean,
): number | null {
  const kandidaten = [
    prev,
    live,
    !bffAutoritativ && historyToday > 0 ? historyToday : null,
  ].filter((v): v is number => v != null && v > 0)
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
  const hrPoints = history.hrSeries.filter((p) => isoAusMs(p.t) === record.date)
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
  const steps =
    record.bffMetrics && record.steps != null
      ? record.steps
      : mergeTagesSchritte(
          record.steps,
          record.date === heuteIsoLocal() ? schritteHeuteAusDaily() : 0,
          record.strain,
          (z.z1 ?? 0) + (z.z2 ?? 0) + (z.z3 ?? 0),
          record.avgHr,
          rhr,
        )

  const vo2Max =
    record.bffMetrics && record.vo2Max != null
      ? record.vo2Max
      : vo2Trends.manuell ?? vo2Trends.vo2Max ?? record.vo2Max

  return speichereZonenImTag(
    {
      ...record,
      avgHr,
      vo2Max,
      steps,
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
  const strain =
    prevHeute.strainFromCloud && prevHeute.strain != null
      ? prevHeute.strain
      : mergeTagesStrain(liveStrain, prevHeute.strain)

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
        hrvRmssd:
          prevHeute.bffMetrics && prevHeute.hrvRmssd != null
            ? prevHeute.hrvRmssd
            : (scores?.hrvRmssdMs ?? prevHeute.hrvRmssd),
        restingHr:
          prevHeute.bffMetrics && prevHeute.restingHr != null
            ? prevHeute.restingHr
            : recoveryLocked && prevHeute.restingHr != null
              ? prevHeute.restingHr
              : (scores?.restingHrBpm ?? prevHeute.restingHr),
        respiratoryRate:
          prevHeute.bffMetrics && prevHeute.respiratoryRate != null
            ? prevHeute.respiratoryRate
            : prevHeute.respiratoryRate ??
              schaetzeAtemfrequenz(scores?.restingHrBpm ?? null, history.baselines.restingHrBpm),
        skinTempC: snapshot.live?.skinTempC ?? prevHeute.skinTempC,
        skinTempDelta: skinDelta ?? prevHeute.skinTempDelta,
        calories:
          prevHeute.bffMetrics && prevHeute.calories != null
            ? prevHeute.calories
            : mergeKalorien(
                scores?.caloriesKcal,
                prevHeute.calories,
                history.caloriesToday,
                Boolean(prevHeute.bffMetrics && prevHeute.calories != null),
              ),
        steps:
          prevHeute.bffMetrics && prevHeute.steps != null
            ? prevHeute.steps
            : mergeTagesSchritte(
                prevHeute.steps,
                Math.max(history.stepsToday ?? 0, schritteHeuteAusDaily()),
                strain,
                zoneMin13(z),
                scores?.avgHrSession ?? prevHeute.avgHr,
                scores?.restingHrBpm ?? prevHeute.restingHr ?? history.baselines.restingHrBpm,
              ),
        maxHr: scores?.maxHrToday ?? prevHeute.maxHr,
        avgHr:
          prevHeute.bffMetrics && prevHeute.avgHr != null
            ? prevHeute.avgHr
            : (scores?.avgHrSession ?? prevHeute.avgHr),
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

export const MAX_TAGE_NAVIGATION = 35

export function isoAddDays(iso: string, days: number): string {
  return isoAddDaysKalender(iso, days)
}

export function tagRecordFuerDatum(date: string, store = ladeDailyStore()): WhoopDayRecord {
  const found = store.days.find((d) => d.date === date)
  return found ? { ...found } : createEmptyDayRecord(date)
}

/** 7-Tage-Fenster mit anchorIso als letztem Tag (für Charts um gewählten Tag). */
export function fenster7TageUmDatum(anchorIso: string): WhoopDayRecord[] {
  const store = ladeDailyStore()
  const out: WhoopDayRecord[] = []
  for (let i = 6; i >= 0; i--) {
    out.push(tagRecordFuerDatum(isoAddDays(anchorIso, -i), store))
  }
  return out
}

export function labelTagNavigation(iso: string): string {
  const heute = heuteIsoLocal()
  if (iso === heute) return 'Heute'
  if (iso === isoAddDays(heute, -1)) return 'Gestern'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function kannTagZurueck(iso: string, maxTage = MAX_TAGE_NAVIGATION): boolean {
  const earliest = isoAddDays(heuteIsoLocal(), -(maxTage - 1))
  return iso > earliest
}

export function kannTagVor(iso: string): boolean {
  return iso < heuteIsoLocal()
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
