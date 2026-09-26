/**
 * Anzeige-Quelle: Whoop Cloud vs Omnia — Umschalten zum Vergleich.
 * Omnia = streng lokal (kein Cloud-Fallback), damit die Qualität sichtbar ist.
 */

import { istOmniaOfflineMode } from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
import {
  createEmptyDayRecord,
  ladeDailyStore,
  schaetzeAtemfrequenz,
  speichereDailyStore,
  type WhoopDayRecord,
} from '@/lib/fitnessdaten/daily-records'
import { ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import { heuteIsoLocal, recoveryAusBaseline } from '@/lib/fitnessdaten/scores'
import { berechneSchlafbedarf, schaetzeRemTief } from '@/lib/fitnessdaten/sleep-detail'
import { strainAusStrainLoad } from '@/lib/fitnessdaten/strain-engine'

export type DisplaySource = 'whoop' | 'omnia'

export const DISPLAY_SOURCE_KEY = 'mein-haushalt:fitness-display-source'
export const DISPLAY_SOURCE_EVENT = 'mein-haushalt:fitness-display-source'

export function ladeDisplaySource(): DisplaySource {
  if (typeof window === 'undefined') return 'whoop'
  if (istOmniaOfflineMode()) return 'omnia'
  try {
    const v = window.localStorage.getItem(DISPLAY_SOURCE_KEY)
    return v === 'omnia' ? 'omnia' : 'whoop'
  } catch {
    return 'whoop'
  }
}

export function setzeDisplaySource(source: DisplaySource): void {
  if (typeof window === 'undefined') return
  if (istOmniaOfflineMode() && source === 'whoop') {
    window.dispatchEvent(
      new CustomEvent(DISPLAY_SOURCE_EVENT, { detail: { source: 'omnia', blocked: true } }),
    )
    return
  }
  window.localStorage.setItem(DISPLAY_SOURCE_KEY, source)
  window.dispatchEvent(new CustomEvent(DISPLAY_SOURCE_EVENT, { detail: { source } }))
}

export function istOmniaAnzeige(): boolean {
  return ladeDisplaySource() === 'omnia'
}

function letzteManuelleSpo2(date: string): number | null {
  const store = ladeDailyStore()
  const hits = (store.vitals ?? [])
    .filter((v) => v.date === date && v.spo2Manual != null)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  return hits[0]?.spo2Manual ?? null
}

/**
 * Schreibt BLE-History-Shadows auf den heutigen Tagesdatensatz
 * (auch wenn Cloud die UI-Felder belegt hat).
 */
export function hydratisiereHeutigeLocalShadows(): WhoopDayRecord | null {
  if (typeof window === 'undefined') return null
  const heute = heuteIsoLocal()
  const history = ladeFitnessHistory()
  const store = ladeDailyStore()
  let rec = store.days.find((d) => d.date === heute)
  if (!rec) {
    rec = createEmptyDayRecord(heute)
    store.days.push(rec)
  }

  let changed = false

  if (history.localStrainDate === heute) {
    const strain =
      history.localStrain ??
      (history.localStrainLoad != null ? strainAusStrainLoad(history.localStrainLoad) : null)
    if (strain != null && strain > 0 && rec.localStrain !== strain) {
      rec.localStrain = strain
      changed = true
    }
  }

  if (history.localHrv != null && history.localHrv > 0) {
    if (rec.localHrv !== history.localHrv) {
      rec.localHrv = history.localHrv
      changed = true
    }
  }
  if (history.localRhr != null && history.localRhr > 0) {
    if (rec.localRhr !== history.localRhr) {
      rec.localRhr = history.localRhr
      changed = true
    }
  }

  // Recovery aus lokalen Vitals, sobald HRV+RHR da sind (nicht nur Morgenfenster)
  if (
    (history.localRecoveryDate === heute && history.localRecoveryPercent != null) ||
    (rec.localHrv != null && rec.localRhr != null)
  ) {
    let recPct = history.localRecoveryDate === heute ? history.localRecoveryPercent : null
    if (recPct == null && rec.localHrv != null && rec.localRhr != null) {
      const computed = recoveryAusBaseline(
        rec.localHrv,
        rec.localRhr,
        history.baselines.hrvRmssdMs,
        history.baselines.restingHrBpm,
        rec.localSleepScore,
      )
      recPct = computed?.percent ?? null
    }
    if (recPct != null && rec.localRecoveryPercent !== recPct) {
      rec.localRecoveryPercent = recPct
      changed = true
    }
  }

  const steps = history.localStepsToday ?? 0
  if (steps > 0 && rec.localSteps !== steps) {
    rec.localSteps = steps
    changed = true
  }
  const kcal = Math.round(history.localCaloriesToday ?? 0)
  if (kcal > 0 && rec.localCalories !== kcal) {
    rec.localCalories = kcal
    changed = true
  }

  if (rec.localRhr != null) {
    const resp = schaetzeAtemfrequenz(rec.localRhr, history.baselines.restingHrBpm)
    if (resp != null && rec.localRespiratoryRate !== resp) {
      rec.localRespiratoryRate = resp
      changed = true
    }
  }

  // Sleep-Need / Stages aus lokalem Schlaf ableiten
  if (rec.localSleepMinutes != null && rec.localSleepMinutes > 0) {
    const defizit = Math.max(0, 480 - rec.localSleepMinutes)
    const need = berechneSchlafbedarf(rec.localStrain ?? null, defizit)
    if (rec.localSleepNeedMinutes !== need) {
      rec.localSleepNeedMinutes = need
      changed = true
    }
    const stages = schaetzeRemTief(rec.localSleepMinutes)
    if (rec.localRemMinutes !== stages.rem) {
      rec.localRemMinutes = stages.rem
      changed = true
    }
    if (rec.localDeepMinutes !== stages.deep) {
      rec.localDeepMinutes = stages.deep
      changed = true
    }
    if (rec.localLightMinutes !== stages.light) {
      rec.localLightMinutes = stages.light
      changed = true
    }
    if (rec.localAwakeMinutes !== stages.awake) {
      rec.localAwakeMinutes = stages.awake
      changed = true
    }
  }

  if (changed) speichereDailyStore(store)
  return rec
}

/** Whoop-Ansicht: Cloud-/Store-Primärfelder. */
export function projektWhoopDisplay(day: WhoopDayRecord): WhoopDayRecord {
  return { ...day }
}

/**
 * Omnia-Ansicht: NUR lokale Shadows / BLE / manuell.
 * Fehlende Werte → null (kein Cloud-Fallback).
 */
export function projektOmniaDisplay(day: WhoopDayRecord): WhoopDayRecord {
  const heute = heuteIsoLocal()
  // Heute: History → Day-Shadows nachziehen, bevor wir projizieren
  const hydrated = day.date === heute ? hydratisiereHeutigeLocalShadows() : null
  const src = hydrated ?? day
  const manualSpo2 = letzteManuelleSpo2(src.date)

  return {
    ...src,
    strainFromCloud: false,
    recoveryLocked: false,
    stepsFromCloud: false,
    caloriesFromCloud: false,
    bffMetrics: false,
    spo2FromCloud: false,

    strain: src.localStrain ?? null,
    recoveryPercent: src.localRecoveryPercent ?? null,
    sleepScore: src.localSleepScore ?? null,
    sleepMinutes: src.localSleepMinutes ?? null,
    sleepEfficiency: src.localSleepEfficiency ?? null,
    sleepNeedMinutes: src.localSleepNeedMinutes ?? null,
    remMinutes: src.localRemMinutes ?? null,
    deepMinutes: src.localDeepMinutes ?? null,
    lightMinutes: src.localLightMinutes ?? null,
    awakeMinutes: src.localAwakeMinutes ?? null,
    sleepConsistency: src.localSleepConsistency ?? null,
    steps: src.localSteps ?? null,
    calories: src.localCalories ?? null,
    restingHr: src.localRhr ?? null,
    hrvRmssd: src.localHrv ?? null,
    respiratoryRate: src.localRespiratoryRate ?? null,
    spo2Percent: manualSpo2,
    vo2Max: null,
    avgHr: null,
  }
}

export function projektDisplayFuerQuelle(
  day: WhoopDayRecord,
  source: DisplaySource = ladeDisplaySource(),
): WhoopDayRecord {
  return source === 'omnia' ? projektOmniaDisplay(day) : projektWhoopDisplay(day)
}
