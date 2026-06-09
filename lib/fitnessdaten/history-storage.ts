import { registriereMotion, aktualisiereSchlafSchaetzung } from '@/lib/fitnessdaten/sleep-estimate'
import { loescheSyncDaten } from '@/lib/fitnessdaten/offline-sync'
import {
  createEmptyDayRecord,
  ladeDailyStore,
  loescheDailyStore,
} from '@/lib/fitnessdaten/daily-records'
import {
  ladeFitnessProfil,
  profilAlter,
  profilGewichtKg,
  profilMaennlich,
  profilMaxHr,
  wendeProfilAufHistory,
} from '@/lib/fitnessdaten/user-profile'
import { schritteHeuteAusDaily, verarbeiteAccelSchritt } from '@/lib/fitnessdaten/steps-engine'
import {
  avgHr,
  heuteIsoLocal,
  istMorgenFenster,
  kalorienDelta,
  leereZonen,
  maxHr,
  mergeTagesStrain,
  recoveryAusBaseline,
  recoveryLabelAusProzent,
  ruhepulsSchaetzung,
  sekundenZuMinuten,
  strainAusZonen,
  zoneFuerBpm,
} from '@/lib/fitnessdaten/scores'
import type {
  FitnessHistoryState,
  FitnessHrPoint,
  FitnessSnapshot,
  HrZoneKey,
  WhoopDeviceInfo,
} from '@/lib/fitnessdaten/types'
import {
  FITNESS_HISTORY_STORAGE_KEY,
  FITNESS_SNAPSHOT_STORAGE_KEY,
} from '@/lib/fitnessdaten/types'

const MAX_HR_SERIES = 600
const MAX_CHART_POINTS = 120
const MAX_HRV_SAMPLES = 200

function defaultHistory(): FitnessHistoryState {
  const profile = ladeFitnessProfil()
  const age = profilAlter(profile)
  const history: FitnessHistoryState = {
    version: 1,
    hrSeries: [],
    hrvSamples: [],
    rhrSamples: [],
    dayStrain: 0,
    dayStrainDate: heuteIsoLocal(),
    zoneSecondsToday: leereZonen(),
    caloriesToday: 0,
    stepsToday: 0,
    stepsDate: heuteIsoLocal(),
    baselines: { hrvRmssdMs: 45, restingHrBpm: 58 },
    maxHrEstimate: profilMaxHr(profile),
    userAge: age,
  }
  return history
}

export function ladeFitnessHistory(): FitnessHistoryState {
  if (typeof window === 'undefined') return defaultHistory()
  try {
    const raw = window.localStorage.getItem(FITNESS_HISTORY_STORAGE_KEY)
    if (!raw) return defaultHistory()
    const parsed = JSON.parse(raw) as FitnessHistoryState
    if (parsed.version !== 1) return defaultHistory()
    if (parsed.stepsToday == null) parsed.stepsToday = 0
    if (!parsed.stepsDate) parsed.stepsDate = heuteIsoLocal()
    wendeProfilAufHistory(parsed)
    return parsed
  } catch {
    return defaultHistory()
  }
}

export function speichereFitnessHistory(state: FitnessHistoryState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FITNESS_HISTORY_STORAGE_KEY, JSON.stringify(state))
}

export function ladeFitnessSnapshot(): FitnessSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FITNESS_SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FitnessSnapshot
  } catch {
    return null
  }
}

export function speichereFitnessSnapshot(snapshot: FitnessSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FITNESS_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
}

export function parseFitnessSnapshotJson(text: string): FitnessSnapshot {
  const parsed = JSON.parse(text) as FitnessSnapshot
  if (!parsed || typeof parsed.updatedAt !== 'string') {
    throw new Error('Ungültiges Format: Feld „updatedAt“ (ISO-Datum) fehlt.')
  }
  return parsed
}

let letzterHrTick = 0

/** Live-Sample in Snapshot + Historie mergen, Scores berechnen. */
export function mergeLiveSnapshot(
  partial: FitnessSnapshot,
  deviceInfo?: WhoopDeviceInfo | null,
): FitnessSnapshot {
  const history = ladeFitnessHistory()
  const heute = heuteIsoLocal()
  if (history.dayStrainDate !== heute) {
    history.dayStrainDate = heute
    const cloudStrain = ladeDailyStore().days.find((d) => d.date === heute)?.strain
    history.dayStrain = cloudStrain ?? 0
    history.zoneSecondsToday = leereZonen()
    history.caloriesToday = 0
  }
  if (history.stepsDate !== heute) {
    history.stepsDate = heute
    history.stepsToday = 0
  }
  const dailySteps = schritteHeuteAusDaily()
  if (dailySteps > history.stepsToday) history.stepsToday = dailySteps

  const bpm = partial.live?.heartRateBpm
  const now = Date.now()
  let hrHistory: FitnessHrPoint[] = partial.hrHistory ?? []

  if (bpm != null && bpm > 0) {
    const point: FitnessHrPoint = { t: now, bpm }
    history.hrSeries.push(point)
    if (history.hrSeries.length > MAX_HR_SERIES) {
      history.hrSeries = history.hrSeries.slice(-MAX_HR_SERIES)
    }
    hrHistory = [...hrHistory, point].slice(-MAX_CHART_POINTS)

    const dtSec = letzterHrTick > 0 ? Math.min(5, (now - letzterHrTick) / 1000) : 1
    letzterHrTick = now

    const rhr = history.baselines.restingHrBpm
    const zone = zoneFuerBpm(bpm, history.maxHrEstimate, rhr)
    history.zoneSecondsToday[zone] += dtSec
    const profile = ladeFitnessProfil()
    history.caloriesToday += kalorienDelta(
      bpm,
      dtSec,
      profilGewichtKg(profile),
      history.userAge,
      profilMaennlich(profile),
    )

    const rmssd = partial.scores?.hrvRmssdMs
    if (rmssd != null && rmssd > 0) {
      history.hrvSamples.push({ t: now, rmssd })
      if (history.hrvSamples.length > MAX_HRV_SAMPLES) {
        history.hrvSamples = history.hrvSamples.slice(-MAX_HRV_SAMPLES)
      }
      const recent = history.hrvSamples.slice(-30)
      history.baselines.hrvRmssdMs =
        Math.round((recent.reduce((a, s) => a + s.rmssd, 0) / recent.length) * 10) / 10
    }

    const rhrEst = ruhepulsSchaetzung(history.hrSeries.slice(-60))
    if (rhrEst != null) {
      history.rhrSamples.push({ t: now, bpm: rhrEst })
      if (history.rhrSamples.length > 100) history.rhrSamples = history.rhrSamples.slice(-100)
      history.baselines.restingHrBpm = Math.round(
        history.baselines.restingHrBpm * 0.9 + rhrEst * 0.1,
      )
    }
  }

  const sessionHistory = hrHistory
  const rmssd = partial.scores?.hrvRmssdMs ?? null
  const restingHr = ruhepulsSchaetzung(sessionHistory) ?? history.baselines.restingHrBpm

  const prevHeute = ladeDailyStore().days.find((d) => d.date === heute) ?? createEmptyDayRecord(heute)
  const recoveryLocked = Boolean(prevHeute.recoveryLocked && prevHeute.recoveryPercent != null)

  let recoveryPercent: number | null = prevHeute.recoveryPercent
  let recoveryLabel =
    recoveryPercent != null ? recoveryLabelAusProzent(recoveryPercent) : null

  if (!recoveryLocked && istMorgenFenster()) {
    const recovery = recoveryAusBaseline(
      rmssd,
      restingHr,
      history.baselines.hrvRmssdMs,
      history.baselines.restingHrBpm,
    )
    if (recovery) {
      recoveryPercent = recovery.percent
      recoveryLabel = recovery.label
    }
  }

  if (partial.live?.accel) {
    registriereMotion(now, partial.live.accel)
    if (verarbeiteAccelSchritt(partial.live.accel, now, heute)) {
      history.stepsToday = Math.max(history.stepsToday + 1, 0)
    }
  }
  const schlaf = aktualisiereSchlafSchaetzung()

  const sessionStrain = strainAusZonen(history.zoneSecondsToday)
  const dayStrain = mergeTagesStrain(sessionStrain, prevHeute.strain)
  history.dayStrain = dayStrain ?? sessionStrain

  const scores = {
    ...partial.scores,
    hrvRmssdMs: rmssd,
    restingHrBpm: restingHr,
    recoveryPercent,
    recoveryLabel,
    strain: dayStrain,
    dayStrain,
    sleepScore: schlaf.sleepMinutes > 0 ? schlaf.sleepScore : null,
    sleepMinutes: schlaf.sleepMinutes > 0 ? schlaf.sleepMinutes : null,
    sleepEfficiency: schlaf.sleepMinutes > 0 ? schlaf.efficiency : null,
    caloriesKcal: Math.round(history.caloriesToday),
    maxHrToday: maxHr(history.hrSeries.filter((p) => new Date(p.t).toISOString().slice(0, 10) === heute)),
    avgHrSession: avgHr(sessionHistory),
    zoneMinutes: sekundenZuMinuten(history.zoneSecondsToday),
  }

  speichereFitnessHistory(history)

  const snapshot: FitnessSnapshot = {
    ...partial,
    deviceInfo: deviceInfo ?? partial.deviceInfo ?? null,
    hrHistory,
    scores,
  }
  speichereFitnessSnapshot(snapshot)
  return snapshot
}

export function loescheFitnessDaten(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(FITNESS_SNAPSHOT_STORAGE_KEY)
  window.localStorage.removeItem(FITNESS_HISTORY_STORAGE_KEY)
  letzterHrTick = 0
  loescheDailyStore()
  loescheSyncDaten()
}

export function formatZoneAnteil(zoneMinutes: Record<HrZoneKey, number>): { key: HrZoneKey; pct: number }[] {
  const total = Object.values(zoneMinutes).reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  return (Object.keys(zoneMinutes) as HrZoneKey[])
    .filter((k) => k !== 'rest')
    .map((key) => ({ key, pct: Math.round((zoneMinutes[key] / total) * 100) }))
    .filter((z) => z.pct > 0)
}
