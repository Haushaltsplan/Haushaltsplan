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
  source: CalibrationPair['source'] = 'shadow',
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
    source,
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
  opts?: { onlyShadow?: boolean },
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
        'sleep_need',
        'sleep_rem',
        'sleep_deep',
        'sleep_consistency',
        'steps',
        'vo2max',
        'calories',
        'skin_temp',
        'avg_hr',
      ]

  return metrics
    .map((m) => {
      let rows = store.pairs
        .filter((p) => p.metric === m)
        .sort((a, b) => b.date.localeCompare(a.date))
      if (opts?.onlyShadow) {
        rows = rows.filter((p) => p.source === 'shadow' || p.source == null)
      }
      rows = rows.slice(0, lastN)
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
 * Mindestens `minPairs` Paare pro Metrik — nur Shadow-Paare.
 * Passt zusätzlich strainLogBase / τ an, wenn Strain-Bias systematisch.
 */
export function autoFitCalibrationParams(minPairs = 7): CalibrationParams {
  const store = ladeCalibrationLog()
  const params = ladeCalibrationParams()
  const notes: string[] = []

  const shadowRows = (metric: CalibrationMetric) =>
    store.pairs.filter(
      (p) => p.metric === metric && p.local > 0.05 && (p.source === 'shadow' || p.source == null),
    )

  const fitScale = (metric: CalibrationMetric, apply: (k: number) => void, lo: number, hi: number) => {
    const rows = shadowRows(metric)
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

  // Strain-Kurve: bei systematischem Bias Log-Basis / τ nachziehen
  const strainPairs = shadowRows('strain').slice(-30)
  if (strainPairs.length >= minPairs) {
    const bias = strainPairs.reduce((a, r) => a + r.delta, 0) / strainPairs.length
    const medAbs = median(strainPairs.map((r) => Math.abs(r.delta)))
    if (medAbs > 1) {
      if (bias > 0.5) {
        // lokal zu hoch → flachere Kurve (höhere Log-Basis) + etwas mehr τ
        params.strainLogBase = clamp(params.strainLogBase * 1.04, 4000, 12_000)
        params.strainTauRestSec = clamp(params.strainTauRestSec * 1.03, 2500, 8000)
        notes.push(
          `strain: logBase→${Math.round(params.strainLogBase)} τ→${Math.round(params.strainTauRestSec)} (bias +${bias.toFixed(2)}, |med| ${medAbs.toFixed(2)})`,
        )
      } else if (bias < -0.5) {
        params.strainLogBase = clamp(params.strainLogBase * 0.96, 4000, 12_000)
        params.strainTauRestSec = clamp(params.strainTauRestSec * 0.97, 2500, 8000)
        notes.push(
          `strain: logBase→${Math.round(params.strainLogBase)} τ→${Math.round(params.strainTauRestSec)} (bias ${bias.toFixed(2)}, |med| ${medAbs.toFixed(2)})`,
        )
      }
    }
  }

  fitScale('recovery', (k) => {
    params.recoveryScale = clamp(params.recoveryScale * k, 0.7, 1.4)
  }, 0.75, 1.35)

  fitScale('sleep_minutes', (k) => {
    params.sleepMinutesScale = clamp(k, 0.7, 1.4)
  }, 0.7, 1.4)

  fitScale('steps', (k) => {
    params.stepsScale = clamp(k, 0.5, 2.0)
    // Empfindlichkeit leicht mitziehen wenn Scale stark abweicht
    if (k < 0.85) params.stepsSensitivity = clamp(params.stepsSensitivity * 1.05, 0.5, 1.8)
    if (k > 1.15) params.stepsSensitivity = clamp(params.stepsSensitivity * 0.95, 0.5, 1.8)
  }, 0.5, 2.0)

  fitScale('vo2max', (k) => {
    params.vo2Scale = clamp(k, 0.85, 1.2)
  }, 0.85, 1.2)

  fitScale('calories', (k) => {
    params.caloriesScale = clamp(k, 0.7, 1.5)
  }, 0.7, 1.5)

  // Sleep need: Median whoop/local → Strain-Faktor / Basis
  const needPairs = shadowRows('sleep_need').slice(-30)
  if (needPairs.length >= minPairs) {
    const ratios = needPairs.map((p) => p.whoop / p.local)
    const k = median(ratios)
    if (Number.isFinite(k) && k > 0) {
      params.sleepNeedBaseMin = clamp(params.sleepNeedBaseMin * k, 420, 540)
      params.sleepNeedStrainFactor = clamp(params.sleepNeedStrainFactor * k, 4, 14)
      notes.push(
        `sleep_need: base→${Math.round(params.sleepNeedBaseMin)} strainF→${params.sleepNeedStrainFactor.toFixed(1)}`,
      )
    }
  }

  // REM/Deep ratios aus Cloud-Paaren (whoop/sleepMinutes ≈ ratio)
  const remPairs = shadowRows('sleep_rem').slice(-30)
  if (remPairs.length >= minPairs) {
    const ratios = remPairs
      .filter((p) => p.local > 0)
      .map((p) => p.whoop / p.local)
    const k = median(ratios)
    if (Number.isFinite(k) && k > 0) {
      params.sleepRemRatio = clamp(params.sleepRemRatio * k, 0.12, 0.35)
      notes.push(`sleep_rem: ratio→${params.sleepRemRatio.toFixed(3)}`)
    }
  }
  const deepPairs = shadowRows('sleep_deep').slice(-30)
  if (deepPairs.length >= minPairs) {
    const ratios = deepPairs
      .filter((p) => p.local > 0)
      .map((p) => p.whoop / p.local)
    const k = median(ratios)
    if (Number.isFinite(k) && k > 0) {
      params.sleepDeepRatio = clamp(params.sleepDeepRatio * k, 0.1, 0.3)
      notes.push(`sleep_deep: ratio→${params.sleepDeepRatio.toFixed(3)}`)
    }
  }

  // Atemfrequenz: Bias → Baseline verschieben
  const respPairs = shadowRows('respiratory').slice(-30)
  if (respPairs.length >= minPairs) {
    const bias = respPairs.reduce((a, r) => a + r.delta, 0) / respPairs.length
    if (Math.abs(bias) > 0.4) {
      params.respiratoryBaseline = clamp(params.respiratoryBaseline - bias * 0.5, 12, 18)
      notes.push(`respiratory: baseline→${params.respiratoryBaseline.toFixed(2)} (bias ${bias.toFixed(2)})`)
    }
  }

  const rec = shadowRows('recovery').slice(-30)
  if (rec.length >= minPairs) {
    const bias = rec.reduce((a, r) => a + r.delta, 0) / rec.length
    const medAbs = median(rec.map((r) => Math.abs(r.delta)))
    if (bias > 8 || (medAbs > 8 && bias > 3)) {
      params.recoveryHrvWeight = clamp(params.recoveryHrvWeight - 0.03, 0.5, 0.8)
      params.recoveryRhrWeight = 1 - params.recoveryHrvWeight
      notes.push(`recovery: hrvWeight→${params.recoveryHrvWeight.toFixed(2)} (bias ${bias.toFixed(1)})`)
    } else if (bias < -8 || (medAbs > 8 && bias < -3)) {
      params.recoveryHrvWeight = clamp(params.recoveryHrvWeight + 0.03, 0.5, 0.8)
      params.recoveryRhrWeight = 1 - params.recoveryHrvWeight
      notes.push(`recovery: hrvWeight→${params.recoveryHrvWeight.toFixed(2)} (bias ${bias.toFixed(1)})`)
    }
  }

  // Zielmarken dokumentieren
  const strainStat = strainPairs.length
    ? median(strainPairs.map((r) => Math.abs(r.delta)))
    : null
  const recStat = rec.length ? median(rec.map((r) => Math.abs(r.delta))) : null
  if (strainStat != null && strainPairs.length >= minPairs) {
    notes.push(
      strainStat <= 1
        ? `✓ Strain |med| ${strainStat.toFixed(2)} ≤ 1`
        : `✗ Strain |med| ${strainStat.toFixed(2)} > 1 — weiter fitten`,
    )
  }
  if (recStat != null && rec.length >= minPairs) {
    notes.push(
      recStat <= 8
        ? `✓ Recovery |med| ${recStat.toFixed(2)} ≤ 8`
        : `✗ Recovery |med| ${recStat.toFixed(2)} > 8 — weiter fitten`,
    )
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
