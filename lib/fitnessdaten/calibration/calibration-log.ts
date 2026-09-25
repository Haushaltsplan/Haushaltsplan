/** Paar-Log Local vs Whoop-Cloud + Statistik + Auto-Fit. */

import {
  DEFAULT_CALIBRATION_PARAMS,
  ladeCalibrationParams,
  speichereCalibrationParams,
  type CalibrationParams,
} from '@/lib/fitnessdaten/calibration/calibration-params'
import type {
  CalibrationMetric,
  CalibrationMetricStats,
  CalibrationPair,
  CalibrationStore,
} from '@/lib/fitnessdaten/calibration/calibration-types'

export const CALIBRATION_LOG_KEY = 'mein-haushalt:whoop-calibration-log'

const MAX_PAIRS = 2500

function defaultStore(): CalibrationStore {
  return { version: 1, pairs: [], lastFitAt: null, notes: [] }
}

export function ladeCalibrationLog(): CalibrationStore {
  if (typeof window === 'undefined') return defaultStore()
  try {
    const raw = window.localStorage.getItem(CALIBRATION_LOG_KEY)
    if (!raw) return defaultStore()
    const p = JSON.parse(raw) as CalibrationStore
    if (p.version !== 1) return defaultStore()
    return { ...defaultStore(), ...p, pairs: Array.isArray(p.pairs) ? p.pairs : [] }
  } catch {
    return defaultStore()
  }
}

export function speichereCalibrationLog(store: CalibrationStore): void {
  if (typeof window === 'undefined') return
  const pairs = store.pairs.slice(-MAX_PAIRS)
  window.localStorage.setItem(
    CALIBRATION_LOG_KEY,
    JSON.stringify({ ...store, version: 1, pairs }),
  )
}

export function registriereCalibrationPair(
  date: string,
  metric: CalibrationMetric,
  local: number | null | undefined,
  whoop: number | null | undefined,
): void {
  if (local == null || whoop == null) return
  if (!Number.isFinite(local) || !Number.isFinite(whoop)) return
  if (local <= 0 && whoop <= 0) return

  const store = ladeCalibrationLog()
  const delta = Math.round((local - whoop) * 100) / 100
  const pair: CalibrationPair = {
    date,
    metric,
    local: Math.round(local * 100) / 100,
    whoop: Math.round(whoop * 100) / 100,
    delta,
    recordedAt: new Date().toISOString(),
  }

  // Upsert: ein Paar pro Tag+Metrik
  const idx = store.pairs.findIndex((p) => p.date === date && p.metric === metric)
  if (idx >= 0) store.pairs[idx] = pair
  else store.pairs.push(pair)

  speichereCalibrationLog(store)
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export function calibrationStats(
  metric?: CalibrationMetric,
  lastN = 30,
): CalibrationMetricStats[] {
  const store = ladeCalibrationLog()
  const metrics: CalibrationMetric[] = metric
    ? [metric]
    : [
        'strain',
        'recovery',
        'rhr',
        'hrv',
        'respiratory',
        'sleep_minutes',
        'sleep_score',
        'sleep_efficiency',
        'steps',
        'vo2max',
        'calories',
      ]

  return metrics
    .map((m) => {
      const rows = store.pairs
        .filter((p) => p.metric === m)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, lastN)
      if (rows.length === 0) {
        return { metric: m, n: 0, mae: 0, bias: 0, medianAbs: 0 }
      }
      const abs = rows.map((r) => Math.abs(r.delta))
      const mae = abs.reduce((a, b) => a + b, 0) / rows.length
      const bias = rows.reduce((a, r) => a + r.delta, 0) / rows.length
      return {
        metric: m,
        n: rows.length,
        mae: Math.round(mae * 100) / 100,
        bias: Math.round(bias * 100) / 100,
        medianAbs: Math.round(median(abs) * 100) / 100,
      }
    })
    .filter((s) => s.n > 0 || !metric)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Skalen aus Paar-Logs fitten (Median whoop/local).
 * Mindestens `minPairs` Paare pro Metrik.
 */
export function autoFitCalibrationParams(minPairs = 7): CalibrationParams {
  const store = ladeCalibrationLog()
  const params = ladeCalibrationParams()
  const notes: string[] = []

  const fitScale = (metric: CalibrationMetric, apply: (k: number) => void, lo: number, hi: number) => {
    const rows = store.pairs.filter((p) => p.metric === metric && p.local > 0.05)
    if (rows.length < minPairs) return
    const ratios = rows.map((p) => p.whoop / p.local)
    const k = median(ratios)
    if (!Number.isFinite(k) || k <= 0) return
    const next = clamp(k, lo, hi)
    apply(next)
    notes.push(`${metric}: scale→${next.toFixed(3)} (n=${rows.length})`)
  }

  fitScale('strain', (k) => {
    params.strainScale = clamp(params.strainScale * k, 0.6, 1.6)
  }, 0.7, 1.4)

  fitScale('recovery', (k) => {
    params.recoveryScale = clamp(params.recoveryScale * k, 0.7, 1.4)
  }, 0.75, 1.35)

  fitScale('sleep_minutes', (k) => {
    params.sleepMinutesScale = clamp(k, 0.7, 1.4)
  }, 0.7, 1.4)

  fitScale('steps', (k) => {
    params.stepsScale = clamp(k, 0.5, 2.0)
  }, 0.5, 2.0)

  fitScale('vo2max', (k) => {
    params.vo2Scale = clamp(k, 0.85, 1.2)
  }, 0.85, 1.2)

  fitScale('calories', (k) => {
    params.caloriesScale = clamp(k, 0.7, 1.5)
  }, 0.7, 1.5)

  // Recovery-Gewichte: wenn Bias systematisch und HRV-Paare existieren, leicht anpassen
  const rec = store.pairs.filter((p) => p.metric === 'recovery').slice(-30)
  if (rec.length >= minPairs) {
    const bias = rec.reduce((a, r) => a + r.delta, 0) / rec.length
    if (bias > 8) {
      // lokal zu hoch → mehr RHR-Gewicht (dämpft bei hohem RHR)
      params.recoveryHrvWeight = clamp(params.recoveryHrvWeight - 0.03, 0.5, 0.8)
      params.recoveryRhrWeight = 1 - params.recoveryHrvWeight
      notes.push(`recovery: hrvWeight→${params.recoveryHrvWeight.toFixed(2)} (bias ${bias.toFixed(1)})`)
    } else if (bias < -8) {
      params.recoveryHrvWeight = clamp(params.recoveryHrvWeight + 0.03, 0.5, 0.8)
      params.recoveryRhrWeight = 1 - params.recoveryHrvWeight
      notes.push(`recovery: hrvWeight→${params.recoveryHrvWeight.toFixed(2)} (bias ${bias.toFixed(1)})`)
    }
  }

  speichereCalibrationParams(params)
  store.lastFitAt = new Date().toISOString()
  store.notes = [...notes, ...store.notes].slice(0, 40)
  speichereCalibrationLog(store)
  return params
}

export function exportCalibrationJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      params: ladeCalibrationParams(),
      log: ladeCalibrationLog(),
      defaults: DEFAULT_CALIBRATION_PARAMS,
    },
    null,
    2,
  )
}
