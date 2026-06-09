/** WHOOP Cloud — Payload in lokale Stores mergen (Browser). */

import {
  createEmptyDayRecord,
  ergaenzeZonenUndVitals,
  ladeDailyStore,
  speichereDailyStore,
  type WhoopActivity,
  type WhoopDayRecord,
} from '@/lib/fitnessdaten/daily-records'
import { aktualisiereVo2MaxWennFaellig, speichereVo2Trends, ladeVo2Trends } from '@/lib/fitnessdaten/vo2max-engine'
import { heuteIsoLocal, mergeTagesStrain, recoveryLabelAusProzent } from '@/lib/fitnessdaten/scores'
import { berechneSkinTempDelta } from '@/lib/fitnessdaten/skin-temp'
import { ladeSyncState, speichereSyncState } from '@/lib/fitnessdaten/offline-sync'
import type { WhoopCloudSyncPayload, WhoopCloudSyncResult } from '@/lib/fitnessdaten/whoop-cloud-types'
import {
  ladeFitnessProfil,
  speichereFitnessProfil,
  wendeProfilAufHistory,
} from '@/lib/fitnessdaten/user-profile'
import { ladeFitnessHistory, ladeFitnessSnapshot, speichereFitnessHistory, speichereFitnessSnapshot } from '@/lib/fitnessdaten/history-storage'

export const WHOOP_CLOUD_META_KEY = 'mein-haushalt:fitnessdaten-whoop-cloud'
export const WHOOP_CLOUD_SYNC_EVENT = 'mein-haushalt:whoop-cloud-sync'

export type WhoopCloudMeta = {
  lastSyncedAt: string | null
  lastSpo2: number | null
  lastSpo2Date: string | null
  lastWorkouts: number
}

export function ladeWhoopCloudMeta(): WhoopCloudMeta {
  const empty: WhoopCloudMeta = {
    lastSyncedAt: null,
    lastSpo2: null,
    lastSpo2Date: null,
    lastWorkouts: 0,
  }
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(WHOOP_CLOUD_META_KEY)
    if (!raw) return empty
    return { ...empty, ...(JSON.parse(raw) as Partial<WhoopCloudMeta>) }
  } catch {
    return empty
  }
}

function speichereWhoopCloudMeta(meta: WhoopCloudMeta): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WHOOP_CLOUD_META_KEY, JSON.stringify(meta))
}

function pick<T>(cloud: T | null | undefined, prev: T | null | undefined): T | null {
  if (cloud != null && cloud !== 0) return cloud as T
  return prev ?? null
}

function pickBff<T>(bff: T | null | undefined, cloud: T | null | undefined, prev: T | null | undefined): T | null {
  if (bff != null && bff !== 0) return bff as T
  return pick(cloud, prev)
}

function mergeDay(
  prev: WhoopDayRecord,
  payload: WhoopCloudSyncPayload,
  date: string,
  skinCtx: { baseline: number | null; days: WhoopDayRecord[] },
  bffRow?: import('@/lib/fitnessdaten/whoop-cloud-types').WhoopBffDailyRow,
): WhoopDayRecord {
  const rec = payload.recoveries.find((r) => r.date === date)
  const sleep = payload.sleeps.find((s) => s.date === date)
  const cycle = payload.cycles.find((c) => c.date === date)
  const cloudRecovery = rec?.recoveryPercent ?? null
  const recoveryLocked =
    cloudRecovery != null ? true : Boolean(prev.recoveryLocked && prev.recoveryPercent != null)
  const hatBff = Boolean(
    bffRow &&
      (bffRow.steps != null ||
        bffRow.calories != null ||
        bffRow.restingHr != null ||
        bffRow.hrvRmssd != null ||
        bffRow.respiratoryRate != null ||
        bffRow.avgHr != null ||
        bffRow.vo2Max != null),
  )

  let skinTempC = prev.skinTempC
  let skinTempDelta = prev.skinTempDelta
  if (rec?.skinTempC != null) {
    const skin = berechneSkinTempDelta(rec.skinTempC, skinCtx.baseline, skinCtx.days, date)
    skinTempC = skin.skinTempC
    skinTempDelta = skin.skinTempDelta
    if (skin.skinTempBaseline != null) skinCtx.baseline = skin.skinTempBaseline
  }

  return {
    ...prev,
    recoveryPercent: cloudRecovery ?? prev.recoveryPercent,
    recoveryLocked,
    bffMetrics: hatBff ? true : prev.bffMetrics,
    hrvRmssd: pickBff(bffRow?.hrvRmssd, rec?.hrvRmssd, prev.hrvRmssd),
    restingHr: pickBff(bffRow?.restingHr, rec?.restingHr, prev.restingHr),
    spo2Percent: pick(rec?.spo2Percent, prev.spo2Percent),
    skinTempC,
    skinTempDelta,
    sleepScore: pick(sleep?.sleepScore, prev.sleepScore),
    sleepEfficiency: pick(sleep?.sleepEfficiency, prev.sleepEfficiency),
    sleepConsistency: pick(sleep?.sleepConsistency, prev.sleepConsistency),
    sleepMinutes: pick(sleep?.sleepMinutes, prev.sleepMinutes),
    sleepNeedMinutes: pick(sleep?.sleepNeedMinutes, prev.sleepNeedMinutes),
    remMinutes: pick(sleep?.remMinutes, prev.remMinutes),
    deepMinutes: pick(sleep?.deepMinutes, prev.deepMinutes),
    lightMinutes: pick(sleep?.lightMinutes, prev.lightMinutes),
    awakeMinutes: pick(sleep?.awakeMinutes, prev.awakeMinutes),
    respiratoryRate: pickBff(bffRow?.respiratoryRate, sleep?.respiratoryRate, prev.respiratoryRate),
    bedTimeMs: pick(sleep?.bedTimeMs, prev.bedTimeMs),
    wakeTimeMs: pick(sleep?.wakeTimeMs, prev.wakeTimeMs),
    strain: mergeTagesStrain(cycle?.strain, prev.strain),
    avgHr: pickBff(bffRow?.avgHr, cycle?.avgHr, prev.avgHr),
    maxHr: pick(cycle?.maxHr, prev.maxHr) ?? prev.maxHr,
    calories:
      bffRow?.calories ??
      (cycle?.calories != null && cycle.calories > 0 ? cycle.calories : prev.calories),
    steps: bffRow?.steps ?? (prev.bffMetrics ? prev.steps : null),
    vo2Max: pickBff(bffRow?.vo2Max, null, prev.vo2Max),
  }
}

function wendeBodyMeasurementsAn(body: WhoopCloudSyncPayload['body']): void {
  if (!body) return
  const profil = ladeFitnessProfil()
  let changed = false
  if (body.heightCm != null) {
    profil.heightCm = body.heightCm
    changed = true
  }
  if (body.weightKg != null) {
    profil.weightKg = body.weightKg
    changed = true
  }
  if (body.maxHr != null) {
    profil.maxHrOverride = body.maxHr
    changed = true
  }
  if (changed) {
    speichereFitnessProfil(profil)
    const history = ladeFitnessHistory()
    wendeProfilAufHistory(history, profil)
    speichereFitnessHistory(history)
  }
}

export function mergeCloudPayload(payload: WhoopCloudSyncPayload): WhoopCloudSyncResult {
  const dates = new Set<string>()
  for (const r of payload.recoveries) dates.add(r.date)
  for (const s of payload.sleeps) dates.add(s.date)
  for (const c of payload.cycles) dates.add(c.date)
  for (const w of payload.workouts) dates.add(w.date)
  for (const b of payload.bff?.daily ?? []) dates.add(b.date)

  const bffByDate = new Map((payload.bff?.daily ?? []).map((b) => [b.date, b]))

  if (dates.size === 0 && payload.workouts.length === 0 && !payload.body) {
    return {
      ok: false,
      syncedAt: new Date().toISOString(),
      message: 'Keine WHOOP-Daten erhalten.',
      fehler: 'Leere Antwort — ggf. noch kein Recovery/Schlaf.',
    }
  }

  const store = ladeDailyStore()
  const byDate = new Map(store.days.map((d) => [d.date, d]))
  const skinCtx = { baseline: store.skinTempBaseline, days: store.days }
  for (const date of dates) {
    const prev = byDate.get(date) ?? createEmptyDayRecord(date)
    byDate.set(date, mergeDay(prev, payload, date, skinCtx, bffByDate.get(date)))
  }
  store.skinTempBaseline = skinCtx.baseline
  if (payload.bff?.monthlyAvgs) {
    store.bffMonthlyAvgs = payload.bff.monthlyAvgs
  }
  const history = ladeFitnessHistory()
  store.days = [...byDate.values()]
    .map((d) => ergaenzeZonenUndVitals(d, history, store))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-365)

  const workoutActivities: WhoopActivity[] = payload.workouts.map((w) => ({
    id: w.id,
    label: w.label,
    strain: w.strain,
    startMs: w.startMs,
    endMs: w.endMs,
    date: w.date,
    sport: w.sport,
    avgHr: w.avgHr,
    maxHr: w.maxHr,
    calories: w.calories,
  }))
  const byId = new Map(store.activities.map((a) => [a.id, a]))
  for (const a of workoutActivities) byId.set(a.id, a)
  store.activities = [...byId.values()].sort((a, b) => a.startMs - b.startMs).slice(-500)

  speichereDailyStore(store)

  if (payload.bff?.monthlyAvgs.vo2Max != null) {
    const vo2 = ladeVo2Trends()
    vo2.vo2Max = payload.bff.monthlyAvgs.vo2Max
    vo2.manuell = payload.bff.monthlyAvgs.vo2Max
    speichereVo2Trends(vo2)
  } else {
    aktualisiereVo2MaxWennFaellig()
  }

  const heute = heuteIsoLocal()
  const heuteRecord = store.days.find((d) => d.date === heute)
  if (heuteRecord?.strain != null && heuteRecord.strain > 0) {
    const history = ladeFitnessHistory()
    history.dayStrain = heuteRecord.strain
    history.dayStrainDate = heute
    speichereFitnessHistory(history)
  }

  const snapshot = ladeFitnessSnapshot()
  if (snapshot && heuteRecord) {
    const scores = { ...snapshot.scores }
    if (heuteRecord.strain != null) {
      scores.strain = heuteRecord.strain
      scores.dayStrain = heuteRecord.strain
    }
    if (heuteRecord.recoveryPercent != null) {
      scores.recoveryPercent = heuteRecord.recoveryPercent
      scores.recoveryLabel = recoveryLabelAusProzent(heuteRecord.recoveryPercent)
    }
    if (heuteRecord.calories != null) scores.caloriesKcal = heuteRecord.calories
    if (heuteRecord.zoneMinutes) scores.zoneMinutes = heuteRecord.zoneMinutes
    speichereFitnessSnapshot({
      ...snapshot,
      scores,
      live: snapshot.live
        ? {
            ...snapshot.live,
            skinTempC: heuteRecord.skinTempC ?? snapshot.live.skinTempC,
          }
        : snapshot.live,
    })
  }

  wendeBodyMeasurementsAn(payload.body)

  const syncedAt = new Date().toISOString()

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WHOOP_CLOUD_SYNC_EVENT, { detail: { syncedAt } }))
  }

  const neuesteRec = payload.recoveries[payload.recoveries.length - 1]
  const mitSpo2 = payload.recoveries.filter((r) => r.spo2Percent != null).length

  speichereWhoopCloudMeta({
    lastSyncedAt: syncedAt,
    lastSpo2: neuesteRec?.spo2Percent ?? null,
    lastSpo2Date: neuesteRec?.date ?? null,
    lastWorkouts: payload.workouts.length,
  })

  const sync = ladeSyncState()
  sync.lastSyncedAt = syncedAt
  sync.message = `WHOOP Cloud: ${dates.size} Tage, ${payload.workouts.length} Workouts`
  speichereSyncState(sync)

  const bffInfo = payload.bff?.debug
    ? ` · BFF: ${payload.bff.debug.strainDays} Schritt-Tage, ${payload.bff.debug.trendsOk}/7 Trends`
    : ''

  return {
    ok: true,
    payload,
    syncedAt,
    message: `${dates.size} Tage · ${payload.sleeps.length} Schlaf · ${payload.workouts.length} Workouts · ${mitSpo2} mit SpO₂${bffInfo}`,
    stats: {
      recoveries: payload.recoveries.length,
      sleeps: payload.sleeps.length,
      cycles: payload.cycles.length,
      workouts: payload.workouts.length,
      mitSpo2,
    },
  }
}

export async function syncWhoopCloudVomServer(): Promise<WhoopCloudSyncResult> {
  const res = await fetch('/api/fitnessdaten/whoop/sync', { method: 'POST', credentials: 'include' })
  const data = (await res.json()) as WhoopCloudSyncResult & { payload?: WhoopCloudSyncPayload }
  if (!res.ok || !data.ok || !data.payload) {
    return {
      ok: false,
      syncedAt: new Date().toISOString(),
      message: data.fehler ?? data.message ?? 'Sync fehlgeschlagen',
      fehler: data.fehler ?? data.message,
    }
  }
  return mergeCloudPayload(data.payload)
}

/** @deprecated — nutze mergeCloudPayload */
export function mergeCloudRecoveries(rows: WhoopCloudSyncPayload['recoveries']): WhoopCloudSyncResult {
  return mergeCloudPayload({ recoveries: rows, sleeps: [], cycles: [], workouts: [], body: null, bff: null })
}
