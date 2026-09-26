/**
 * Anzeige-Quelle: Whoop Cloud vs Omnia — Umschalten zum Vergleich.
 * Omnia = streng lokal (kein Cloud-Fallback), damit die Qualität sichtbar ist.
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

/**
 * Omnia-Ansicht: NUR lokale Shadows / BLE / manuell.
 * Fehlende Werte → null (kein Cloud-Fallback), damit die Lücken sichtbar bleiben.
 */
export function projektOmniaDisplay(day: WhoopDayRecord): WhoopDayRecord {
  const manualSpo2 = letzteManuelleSpo2(day.date)
  return {
    ...day,
    strainFromCloud: false,
    recoveryLocked: false,
    stepsFromCloud: false,
    caloriesFromCloud: false,
    bffMetrics: false,
    spo2FromCloud: false,

    strain: day.localStrain ?? null,
    recoveryPercent: day.localRecoveryPercent ?? null,
    sleepScore: day.localSleepScore ?? null,
    sleepMinutes: day.localSleepMinutes ?? null,
    sleepEfficiency: day.localSleepEfficiency ?? null,
    sleepNeedMinutes: day.localSleepNeedMinutes ?? null,
    remMinutes: day.localRemMinutes ?? null,
    deepMinutes: day.localDeepMinutes ?? null,
    lightMinutes: day.localLightMinutes ?? null,
    awakeMinutes: day.localAwakeMinutes ?? null,
    sleepConsistency: day.localSleepConsistency ?? null,
    steps: day.localSteps ?? null,
    calories: day.localCalories ?? null,
    restingHr: day.localRhr ?? null,
    hrvRmssd: day.localHrv ?? null,
    respiratoryRate: day.localRespiratoryRate ?? null,
    // SpO₂ nur manuell — Cloud-Cache bewusst ausgeblendet
    spo2Percent: manualSpo2,
    // Cloud-VO₂ / Cycle-AvgHR nicht in Omnia-Ansicht
    vo2Max: null,
    avgHr: null,
    // Cycle-/BFF-Kalorien/Schritte schon oben lokal
    // Hauttemp: Gen5/BLE — behalten wenn vorhanden
    // Zonen: lokal aus BLE — behalten
  }
}

export function projektDisplayFuerQuelle(
  day: WhoopDayRecord,
  source: DisplaySource = ladeDisplaySource(),
): WhoopDayRecord {
  return source === 'omnia' ? projektOmniaDisplay(day) : projektWhoopDisplay(day)
}
