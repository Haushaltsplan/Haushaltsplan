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
  | 'steps'
  | 'vo2max'
  | 'calories'

export type CalibrationPair = {
  date: string
  metric: CalibrationMetric
  local: number
  whoop: number
  delta: number
  recordedAt: string
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
