/**
 * Anzeige-Quelle: Whoop Cloud vs Omnia — Umschalten zum Vergleich.
 * Unabhängig vom Abo-Ende-Modus (omniaOfflineMode erzwingt Omnia).
 */

import { istOmniaOfflineMode } from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
import { ladeDailyStore, type WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'

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

/** Whoop-Ansicht: Cloud-/Store-Primärfelder. */
export function projektWhoopDisplay(day: WhoopDayRecord): WhoopDayRecord {
  return { ...day }
}

/** Omnia-Ansicht: Shadows als Primärwerte (Cloud bleibt im Store unberührt). */
export function projektOmniaDisplay(day: WhoopDayRecord): WhoopDayRecord {
  const manualSpo2 = letzteManuelleSpo2(day.date)
  return {
    ...day,
    strain: day.localStrain ?? day.strain,
    recoveryPercent: day.localRecoveryPercent ?? day.recoveryPercent,
    sleepScore: day.localSleepScore ?? day.sleepScore,
    sleepMinutes: day.localSleepMinutes ?? day.sleepMinutes,
    sleepEfficiency: day.localSleepEfficiency ?? day.sleepEfficiency,
    sleepNeedMinutes: day.localSleepNeedMinutes ?? day.sleepNeedMinutes,
    remMinutes: day.localRemMinutes ?? day.remMinutes,
    deepMinutes: day.localDeepMinutes ?? day.deepMinutes,
    lightMinutes: day.localLightMinutes ?? day.lightMinutes,
    awakeMinutes: day.localAwakeMinutes ?? day.awakeMinutes,
    sleepConsistency: day.localSleepConsistency ?? day.sleepConsistency,
    steps: day.localSteps ?? day.steps,
    calories: day.localCalories ?? day.calories,
    restingHr: day.localRhr ?? day.restingHr,
    hrvRmssd: day.localHrv ?? day.hrvRmssd,
    respiratoryRate: day.localRespiratoryRate ?? day.respiratoryRate,
    // SpO₂: manueller Eintrag > Cloud-Cache (Band streamt SpO₂ nicht per Live-BLE)
    spo2Percent: manualSpo2 ?? day.spo2Percent,
  }
}

export function projektDisplayFuerQuelle(
  day: WhoopDayRecord,
  source: DisplaySource = ladeDisplaySource(),
): WhoopDayRecord {
  return source === 'omnia' ? projektOmniaDisplay(day) : projektWhoopDisplay(day)
}
