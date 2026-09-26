/** Whoop-Offline-Kalibrierung — Typen. */

export type CalibrationMetric =
  | 'strain'
  | 'recovery'
  | 'rhr'
  | 'hrv'
  | 'respiratory'
  | 'sleep_minutes'
  | 'sleep_score'
  | 'sleep_efficiency'
  | 'sleep_need'
  | 'sleep_rem'
  | 'sleep_deep'
  | 'sleep_consistency'
  | 'steps'
  | 'vo2max'
  | 'calories'
  | 'skin_temp'
  | 'spo2'
  | 'avg_hr'

export type CalibrationPair = {
  date: string
  metric: CalibrationMetric
  local: number
  whoop: number
  delta: number
  recordedAt: string
  /** Nur 'shadow' zählt für Phase-A-Ziele (echte Dual-Lauf-Paare). */
  source?: 'shadow' | 'formula' | 'echo'
}

export type CalibrationMetricStats = {
  metric: CalibrationMetric
  n: number
  mae: number
  bias: number
  medianAbs: number
}

export type CalibrationStore = {
  version: 1
  pairs: CalibrationPair[]
  lastFitAt: string | null
  notes: string[]
}
