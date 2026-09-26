/** Kennzeichnung: Whoop Cloud vs Omnia (kalibriert). */

import { istOmniaOfflineMode } from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
import {
  istOmniaAnzeige,
  projektDisplayFuerQuelle,
} from '@/lib/fitnessdaten/calibration/display-source'
import type { WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'

export type MetricSourceKind = 'whoop-cloud' | 'omnia'

export type MetricSourceKey =
  | 'strain'
  | 'recovery'
  | 'sleep'
  | 'steps'
  | 'calories'
  | 'hrv'
  | 'rhr'
  | 'respiratory'

export function metricSourceLabel(kind: MetricSourceKind): string {
  return kind === 'whoop-cloud' ? 'Whoop Cloud' : 'Omnia'
}

/**
 * Quelle für die angezeigte Metrik — folgt dem Anzeige-Toggle.
 */
export function metricSourceFuer(
  key: MetricSourceKey,
  day: WhoopDayRecord | null | undefined,
): MetricSourceKind {
  if (istOmniaAnzeige() || istOmniaOfflineMode()) return 'omnia'
  if (!day) return 'omnia'
  switch (key) {
    case 'strain':
      return day.strainFromCloud && day.strain != null ? 'whoop-cloud' : 'omnia'
    case 'recovery':
      return day.recoveryLocked && day.recoveryPercent != null ? 'whoop-cloud' : 'omnia'
    case 'sleep':
      if (day.sleepScore != null || day.sleepMinutes != null) return 'whoop-cloud'
      return 'omnia'
    case 'steps':
      return day.stepsFromCloud && day.steps != null ? 'whoop-cloud' : 'omnia'
    case 'calories':
      return day.caloriesFromCloud && day.calories != null ? 'whoop-cloud' : 'omnia'
    case 'hrv':
    case 'rhr':
    case 'respiratory':
      return day.bffMetrics || day.recoveryLocked ? 'whoop-cloud' : 'omnia'
    default:
      return 'omnia'
  }
}

/** Display-Projektion nach aktuellem Toggle (Whoop | Omnia). */
export function projektOfflineDisplay(day: WhoopDayRecord): WhoopDayRecord {
  return projektDisplayFuerQuelle(day)
}
