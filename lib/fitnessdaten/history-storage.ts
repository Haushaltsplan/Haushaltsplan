import { istOmniaOfflineMode } from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
import { registriereMotion, aktualisiereSchlafSchaetzung } from '@/lib/fitnessdaten/sleep-estimate'
import { berechneSchlafbedarf, schaetzeRemTief } from '@/lib/fitnessdaten/sleep-detail'
import { loescheSyncDaten } from '@/lib/fitnessdaten/offline-sync'
import {
  createEmptyDayRecord,
  ladeDailyStore,
  loescheDailyStore,
  schaetzeAtemfrequenz,
  speichereDailyStore,
} from '@/lib/fitnessdaten/daily-records'
import {
  ladeFitnessProfil,
  profilAlter,
  profilGewichtKg,
  profilMaennlich,
  profilMaxHr,
  wendeProfilAufHistory,
} from '@/lib/fitnessdaten/user-profile'
import { isoAusMs } from '@/lib/fitnessdaten/iso-date'
import { schritteHeuteAusDaily, verarbeiteAccelSchritt } from '@/lib/fitnessdaten/steps-engine'
import {
  decayStrainLoad,
  loadAusStrain,
  strainAusStrainLoad,
  tickStrainLoad,
} from '@/lib/fitnessdaten/strain-engine'
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
import { safeLocalStorageSetItem } from '@/lib/local-storage-safe'

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
  // Hart kürzen vor dem Schreiben — HR-Serie ist der größte Block
  const trimmed: FitnessHistoryState = {
    ...state,
    hrSeries: (state.hrSeries ?? []).slice(-400),
    hrvSamples: (state.hrvSamples ?? []).slice(-150),
    rhrSamples: (state.rhrSamples ?? []).slice(-80),
  }
  safeLocalStorageSetItem(FITNESS_HISTORY_STORAGE_KEY, JSON.stringify(trimmed))
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
  safeLocalStorageSetItem(FITNESS_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
}

export function parseFitnessSnapshotJson(text: string): FitnessSnapshot {
  const parsed = JSON.parse(text) as FitnessSnapshot
  if (!parsed || typeof parsed.updatedAt !== 'string') {
    throw new Error('Ungültiges Format: Feld „updatedAt“ (ISO-Datum) fehlt.')
  }
  return parsed
}

let letzterHrTick = 0

function normalisiereStrainState(history: FitnessHistoryState): void {
  if (history.strainLoad == null) {
    const basis = history.strainScore ?? history.dayStrain ?? 0
    history.strainLoad = loadAusStrain(basis)
    history.strainScore = strainAusStrainLoad(history.strainLoad)
    if (history.lastStrainTick == null) {
      const snap = ladeFitnessSnapshot()
      const snapAt = snap?.updatedAt ? Date.parse(snap.updatedAt) : Date.now()
      history.lastStrainTick = Number.isFinite(snapAt) ? snapAt : Date.now()
    }
  }
  if (history.strainScore == null) {
    history.strainScore = strainAusStrainLoad(history.strainLoad ?? 0)
  }
  if (history.lastStrainTick == null) {
    history.lastStrainTick = Date.now()
  }
}

function wendeStrainZeitDecay(history: FitnessHistoryState, now: number): void {
  normalisiereStrainState(history)
  const dtSec = Math.min(7200, (now - history.lastStrainTick!) / 1000)
  if (dtSec < 1) return
  history.strainLoad = decayStrainLoad(history.strainLoad!, dtSec)
  history.strainScore = strainAusStrainLoad(history.strainLoad)
  history.lastStrainTick = now
}

function normalisiereLocalStrainShadow(history: FitnessHistoryState, heute: string): void {
  if (history.localStrainDate !== heute) {
    history.localStrainDate = heute
    history.localStrainLoad = 0
    history.localStrain = 0
    history.localLastStrainTick = Date.now()
  }
  if (history.localStrainLoad == null) history.localStrainLoad = 0
  if (history.localStrain == null) {
    history.localStrain = strainAusStrainLoad(history.localStrainLoad)
  }
  if (history.localLastStrainTick == null) history.localLastStrainTick = Date.now()
}

function wendeLocalStrainDecay(history: FitnessHistoryState, now: number): void {
  const heute = heuteIsoLocal()
  normalisiereLocalStrainShadow(history, heute)
  const dtSec = Math.min(7200, (now - history.localLastStrainTick!) / 1000)
  if (dtSec < 1) return
  history.localStrainLoad = decayStrainLoad(history.localStrainLoad!, dtSec)
  history.localStrain = strainAusStrainLoad(history.localStrainLoad)
  history.localLastStrainTick = now
}

function schreibeLocalShadowAufTag(history: FitnessHistoryState, heute: string): void {
  const store = ladeDailyStore()
  let rec = store.days.find((d) => d.date === heute)
  if (!rec) {
    rec = createEmptyDayRecord(heute)
    store.days.push(rec)
  }
  if (history.localStrain != null && history.localStrain > 0) {
    rec.localStrain = history.localStrain
  }
  if (history.localRecoveryDate === heute) {
    if (history.localRecoveryPercent != null) rec.localRecoveryPercent = history.localRecoveryPercent
    if (history.localRhr != null) rec.localRhr = history.localRhr
    if (history.localHrv != null) rec.localHrv = history.localHrv
  }
  speichereDailyStore(store)
}

function setzeStrainAusCloud(history: FitnessHistoryState, strain: number): void {
  history.strainScore = strain
  history.strainLoad = loadAusStrain(strain)
  history.dayStrain = strain
  history.lastStrainTick = Date.now()
  // Shadow bewusst NICHT anfassen
}

/** Strain-Abklingen für UI (ohne neuen BLE-Tick), z. B. alle 60 s. */
export function aktualisiereStrainFuerAnzeige(minIntervallSec = 30): boolean {
  if (typeof window === 'undefined') return false
  const history = ladeFitnessHistory()
  const heute = heuteIsoLocal()
  if (history.dayStrainDate !== heute && history.localStrainDate !== heute) return false

  const offline = istOmniaOfflineMode()
  const now = Date.now()
  // Shadow immer abklingen lassen
  if (history.localStrainDate === heute) {
    wendeLocalStrainDecay(history, now)
  }

  const prevHeute = ladeDailyStore().days.find((d) => d.date === heute)
  if (!offline && prevHeute?.strainFromCloud && prevHeute.strain != null) {
    setzeStrainAusCloud(history, prevHeute.strain)
    schreibeLocalShadowAufTag(history, heute)
    speichereFitnessHistory(history)
    const snap = ladeFitnessSnapshot()
    if (snap?.scores && Math.abs((snap.scores.strain ?? 0) - prevHeute.strain) >= 0.05) {
      speichereFitnessSnapshot({
        ...snap,
        scores: { ...snap.scores, strain: prevHeute.strain, dayStrain: prevHeute.strain },
      })
      return true
    }
    return false
  }

  normalisiereStrainState(history)
  const dtSec = (now - history.lastStrainTick!) / 1000
  if (dtSec < minIntervallSec && (history.localLastStrainTick == null || (now - history.localLastStrainTick) / 1000 < minIntervallSec)) {
    return false
  }

  const vorher = history.strainScore ?? 0
  wendeStrainZeitDecay(history, now)
  if (offline && history.localStrain != null) {
    history.strainScore = history.localStrain
    history.dayStrain = history.localStrain
  } else {
    history.dayStrain = history.strainScore!
  }
  schreibeLocalShadowAufTag(history, heute)
  speichereFitnessHistory(history)

  const snap = ladeFitnessSnapshot()
  const displayStrain = offline ? history.localStrain : history.strainScore
  if (snap?.scores && displayStrain != null && Math.abs((snap.scores.strain ?? 0) - displayStrain) >= 0.05) {
    speichereFitnessSnapshot({
      ...snap,
      scores: { ...snap.scores, strain: displayStrain, dayStrain: displayStrain },
    })
    return true
  }
  return Math.abs(vorher - (history.strainScore ?? 0)) >= 0.05
}

/** Live-Sample in Snapshot + Historie mergen, Scores berechnen. */
export function mergeLiveSnapshot(
  partial: FitnessSnapshot,
  deviceInfo?: WhoopDeviceInfo | null,
): FitnessSnapshot {
  const history = ladeFitnessHistory()
  const heute = heuteIsoLocal()
  const offline = istOmniaOfflineMode()
  const prevHeute = ladeDailyStore().days.find((d) => d.date === heute) ?? createEmptyDayRecord(heute)
  const cloudStrainHeute =
    !offline && prevHeute.strainFromCloud ? prevHeute.strain : null

  if (history.dayStrainDate !== heute) {
    history.dayStrainDate = heute
    const cloudStrain = cloudStrainHeute ?? ladeDailyStore().days.find((d) => d.date === heute)?.strain
    history.dayStrain = offline ? 0 : (cloudStrain ?? 0)
    history.strainScore = offline ? 0 : (cloudStrain ?? 0)
    history.strainLoad = loadAusStrain(offline ? 0 : (cloudStrain ?? 0))
    history.lastStrainTick = Date.now()
    history.zoneSecondsToday = leereZonen()
    history.caloriesToday = 0
    history.localCaloriesToday = 0
  }
  normalisiereLocalStrainShadow(history, heute)

  if (history.stepsDate !== heute) {
    history.stepsDate = heute
    history.stepsToday = 0
    history.localStepsToday = 0
  }
  if (history.localCaloriesToday == null) history.localCaloriesToday = 0
  if (history.localStepsToday == null) history.localStepsToday = 0
  const dailySteps = schritteHeuteAusDaily()
  if (dailySteps > history.stepsToday) history.stepsToday = dailySteps

  const bpm = partial.live?.heartRateBpm
  const now = Date.now()
  const profile = ladeFitnessProfil()
  const maennlich = profilMaennlich(profile)

  // UI-Strain: Cloud oder lokaler Banister
  if (cloudStrainHeute != null) {
    setzeStrainAusCloud(history, cloudStrainHeute)
  } else {
    normalisiereStrainState(history)
    wendeStrainZeitDecay(history, now)
  }
  // Shadow-Strain: immer Decay, unabhängig von Cloud
  wendeLocalStrainDecay(history, now)

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

    // Shadow: immer tickStrainLoad
    history.localStrainLoad = tickStrainLoad(
      history.localStrainLoad ?? 0,
      bpm,
      history.maxHrEstimate,
      rhr,
      dtSec,
      maennlich,
    )
    history.localStrain = strainAusStrainLoad(history.localStrainLoad)
    history.localLastStrainTick = now

    // UI-Strain nur ohne Cloud-Lock (oder Offline-Modus)
    if (cloudStrainHeute == null) {
      history.strainLoad = tickStrainLoad(
        history.strainLoad!,
        bpm,
        history.maxHrEstimate,
        rhr,
        dtSec,
        maennlich,
      )
      history.strainScore = strainAusStrainLoad(history.strainLoad)
      history.lastStrainTick = now
    }

    // Shadow-Keytel immer (auch bei Cloud-Kalorien)
    history.localCaloriesToday =
      (history.localCaloriesToday ?? 0) +
      kalorienDelta(
        bpm,
        dtSec,
        profilGewichtKg(profile),
        history.userAge,
        profilMaennlich(profile),
      )

    if (!prevHeute.caloriesFromCloud || offline) {
      history.caloriesToday += kalorienDelta(
        bpm,
        dtSec,
        profilGewichtKg(profile),
        history.userAge,
        profilMaennlich(profile),
      )
    }

    const rmssd = partial.scores?.hrvRmssdMs
    if (rmssd != null && rmssd > 0) {
      history.hrvSamples.push({ t: now, rmssd })
      if (history.hrvSamples.length > MAX_HRV_SAMPLES) {
        history.hrvSamples = history.hrvSamples.slice(-MAX_HRV_SAMPLES)
      }
      const recent = history.hrvSamples.slice(-30)
      history.baselines.hrvRmssdMs =
        Math.round((recent.reduce((a, s) => a + s.rmssd, 0) / recent.length) * 10) / 10
      history.localHrv = rmssd
    }

    const rhrEst = ruhepulsSchaetzung(history.hrSeries.slice(-60))
    if (rhrEst != null) {
      history.rhrSamples.push({ t: now, bpm: rhrEst })
      if (history.rhrSamples.length > 100) history.rhrSamples = history.rhrSamples.slice(-100)
      history.baselines.restingHrBpm = Math.round(
        history.baselines.restingHrBpm * 0.9 + rhrEst * 0.1,
      )
      history.localRhr = rhrEst
    }
  }

  const sessionHistory = hrHistory
  const rmssd = partial.scores?.hrvRmssdMs ?? history.localHrv ?? null
  const restingHr =
    ruhepulsSchaetzung(sessionHistory) ?? history.localRhr ?? history.baselines.restingHrBpm

  const prevHeuteRecord =
    ladeDailyStore().days.find((d) => d.date === heute) ?? createEmptyDayRecord(heute)
  const recoveryLocked =
    !offline && Boolean(prevHeuteRecord.recoveryLocked && prevHeuteRecord.recoveryPercent != null)

  if (partial.live?.accel) {
    registriereMotion(now, partial.live.accel)
    if (verarbeiteAccelSchritt(partial.live.accel, now, heute)) {
      history.localStepsToday = (history.localStepsToday ?? 0) + 1
      if (!prevHeuteRecord.stepsFromCloud || offline) {
        history.stepsToday = Math.max(history.stepsToday + 1, 0)
      }
    }
  }
  const schlaf = aktualisiereSchlafSchaetzung()
  const sleepPerf =
    schlaf.sleepMinutes > 0
      ? schlaf.sleepScore
      : (prevHeuteRecord.localSleepScore ?? prevHeuteRecord.sleepScore ?? null)

  // Lokale Recovery-Shadow (immer im Morgenfenster berechnen)
  if (istMorgenFenster()) {
    const localRec = recoveryAusBaseline(
      rmssd,
      restingHr,
      history.baselines.hrvRmssdMs,
      history.baselines.restingHrBpm,
      sleepPerf,
    )
    if (localRec) {
      history.localRecoveryPercent = localRec.percent
      history.localRecoveryDate = heute
      history.localRhr = restingHr
      history.localHrv = rmssd
    }
  }

  let recoveryPercent: number | null = prevHeuteRecord.recoveryPercent
  let recoveryLabel =
    recoveryPercent != null ? recoveryLabelAusProzent(recoveryPercent) : null

  if (offline && history.localRecoveryPercent != null) {
    recoveryPercent = history.localRecoveryPercent
    recoveryLabel = recoveryLabelAusProzent(recoveryPercent)
  } else if (!recoveryLocked && istMorgenFenster()) {
    const recovery = recoveryAusBaseline(
      rmssd,
      restingHr,
      history.baselines.hrvRmssdMs,
      history.baselines.restingHrBpm,
      sleepPerf,
    )
    if (recovery) {
      recoveryPercent = recovery.percent
      recoveryLabel = recovery.label
    }
  }

  const sessionStrain =
    offline && history.localStrain != null
      ? history.localStrain
      : cloudStrainHeute != null
        ? cloudStrainHeute
        : (history.strainScore ?? 0)
  const dayStrain = mergeTagesStrain(sessionStrain, offline ? history.localStrain : prevHeuteRecord.strain)
  history.dayStrain = dayStrain ?? sessionStrain

  const cloudKcal =
    !offline && prevHeuteRecord.caloriesFromCloud && prevHeuteRecord.calories != null
      ? prevHeuteRecord.calories
      : null
  if (cloudKcal != null) history.caloriesToday = cloudKcal

  // Lokale Sleep/Steps Shadows auf Tag schreiben
  const storeForShadow = ladeDailyStore()
  let dayShadow = storeForShadow.days.find((d) => d.date === heute)
  if (!dayShadow) {
    dayShadow = createEmptyDayRecord(heute)
    storeForShadow.days.push(dayShadow)
  }
  if (schlaf.sleepMinutes > 0) {
    dayShadow.localSleepMinutes = schlaf.sleepMinutes
    dayShadow.localSleepScore = schlaf.sleepScore
    dayShadow.localSleepEfficiency = schlaf.efficiency
  }
  // Sleep-Need / Stages lokal für Dual-Lauf
  {
    const defizit = Math.max(0, 480 - (dayShadow.localSleepMinutes ?? dayShadow.sleepMinutes ?? 0))
    const need = berechneSchlafbedarf(history.localStrain ?? history.strainScore ?? null, defizit)
    dayShadow.localSleepNeedMinutes = need
    const stages = schaetzeRemTief(dayShadow.localSleepMinutes ?? 0)
    dayShadow.localRemMinutes = stages.rem
    dayShadow.localDeepMinutes = stages.deep
    dayShadow.localLightMinutes = stages.light
    dayShadow.localAwakeMinutes = stages.awake
  }
  // Shadow-Schritte/Kalorien immer schreiben (auch bei Cloud) — Dual-Lauf
  const localSteps = history.localStepsToday ?? history.stepsToday
  if (localSteps > 0) {
    dayShadow.localSteps = localSteps
  }
  const localKcal = Math.round(history.localCaloriesToday ?? history.caloriesToday)
  if (localKcal > 0) {
    dayShadow.localCalories = localKcal
  }
  const localResp = schaetzeAtemfrequenz(restingHr, history.baselines.restingHrBpm)
  if (localResp != null) dayShadow.localRespiratoryRate = localResp
  speichereDailyStore(storeForShadow)
  schreibeLocalShadowAufTag(history, heute)

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
    caloriesKcal: cloudKcal ?? Math.round(history.caloriesToday),
    maxHrToday: maxHr(history.hrSeries.filter((p) => isoAusMs(p.t) === heute)),
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
