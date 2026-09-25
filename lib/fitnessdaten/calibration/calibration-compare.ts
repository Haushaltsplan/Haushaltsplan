/**
 * Dual-Lauf: lokale Engines vs Whoop-Cloud-Sollwerte nach Sync.
 * Schreibt nur ins Kalibrierungs-Log — UI bleibt Cloud-autoritativ.
 */

import {
  autoFitCalibrationParams,
  registriereCalibrationPair,
} from '@/lib/fitnessdaten/calibration/calibration-log'
import { ladeCalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'
import { ladeDailyStore, type WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { kalorienDelta, recoveryAusBaseline } from '@/lib/fitnessdaten/scores'
import { berechneVo2MaxAusWhoopVitals } from '@/lib/fitnessdaten/vo2max-from-vitals'
import type { WhoopCloudSyncPayload } from '@/lib/fitnessdaten/whoop-cloud-types'
import { ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import { strainAusStrainLoad, strainAusZonen } from '@/lib/fitnessdaten/strain-engine'
import { ladeFitnessProfil, profilAlter, profilGewichtKg, profilMaennlich } from '@/lib/fitnessdaten/user-profile'

function baselineAusTagen(
  days: WhoopDayRecord[],
  field: 'hrvRmssd' | 'restingHr',
  excludeDate: string,
): number | null {
  const vals = days
    .filter((d) => d.date !== excludeDate)
    .slice(-30)
    .map((d) => d[field])
    .filter((v): v is number => v != null && v > 0)
  if (vals.length < 5) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function localSleepShadow(d: WhoopDayRecord): {
  minutes: number | null
  score: number | null
  efficiency: number | null
} {
  // Ohne Live-IMU: aus Cloud-Feldern rückwärts keine lokale Schätzung —
  // Shadow nur wenn lokale Felder schon gesetzt und nicht cloud-locked.
  return {
    minutes: d.sleepMinutes,
    score: d.sleepScore,
    efficiency: d.sleepEfficiency,
  }
}

/**
 * Nach Cloud-Merge: für jeden Tag mit Whoop-Soll lokale Schattenwerte paaren.
 */
export function kalibriereGegenCloudPayload(payload: WhoopCloudSyncPayload): void {
  if (typeof window === 'undefined') return

  const params = ladeCalibrationParams()
  const store = ladeDailyStore()
  const history = ladeFitnessHistory()
  const byDate = new Map(store.days.map((d) => [d.date, d]))

  const recByDate = new Map(payload.recoveries.map((r) => [r.date, r]))
  const sleepByDate = new Map(payload.sleeps.map((s) => [s.date, s]))
  const cycleByDate = new Map(payload.cycles.map((c) => [c.date, c]))

  const dates = new Set<string>([
    ...recByDate.keys(),
    ...sleepByDate.keys(),
    ...cycleByDate.keys(),
  ])

  for (const date of dates) {
    const day = byDate.get(date)
    const rec = recByDate.get(date)
    const sleep = sleepByDate.get(date)
    const cycle = cycleByDate.get(date)

    // --- Strain ---
    if (cycle?.strain != null && cycle.strain > 0) {
      let localStrain: number | null = null
      if (history.dayStrainDate === date && history.strainLoad != null) {
        localStrain = strainAusStrainLoad(history.strainLoad) * params.strainScale
      } else if (day?.strain != null && !day.strainFromCloud) {
        localStrain = day.strain * params.strainScale
      }
      // Parallel-Schätzung aus Zonen wenn vorhanden
      if (localStrain == null && day?.zoneMinutes) {
        const z = day.zoneMinutes
        const zoneSec = {
          rest: (z.rest ?? 0) * 60,
          z1: (z.z1 ?? 0) * 60,
          z2: (z.z2 ?? 0) * 60,
          z3: (z.z3 ?? 0) * 60,
          z4: (z.z4 ?? 0) * 60,
          z5: (z.z5 ?? 0) * 60,
        }
        const fromZones = strainAusZonen(zoneSec)
        if (fromZones > 0) localStrain = fromZones * params.strainScale
      }
      if (localStrain != null && localStrain > 0) {
        registriereCalibrationPair(date, 'strain', localStrain, cycle.strain)
      }
    }

    // --- Recovery (Formel auf denselben Cloud-Vitalen = reiner Formel-Fit) ---
    if (rec?.recoveryPercent != null && rec.hrvRmssd != null && rec.restingHr != null) {
      const baseHrv = baselineAusTagen(store.days, 'hrvRmssd', date) ?? rec.hrvRmssd
      const baseRhr = baselineAusTagen(store.days, 'restingHr', date) ?? rec.restingHr
      const local = recoveryAusBaseline(rec.hrvRmssd, rec.restingHr, baseHrv, baseRhr)
      if (local) {
        registriereCalibrationPair(date, 'recovery', local.percent, rec.recoveryPercent)
      }
    }

    // RHR/HRV: lokaler Tageswert vs Cloud (wenn BLE-Tageswert existiert)
    if (rec?.restingHr != null && day?.restingHr != null && !day.bffMetrics) {
      registriereCalibrationPair(date, 'rhr', day.restingHr, rec.restingHr)
    }
    if (rec?.hrvRmssd != null && day?.hrvRmssd != null && !day.bffMetrics) {
      registriereCalibrationPair(date, 'hrv', day.hrvRmssd, rec.hrvRmssd)
    }

    // --- Respiratory ---
    if (sleep?.respiratoryRate != null && day?.respiratoryRate != null) {
      registriereCalibrationPair(date, 'respiratory', day.respiratoryRate, sleep.respiratoryRate)
    }

    // --- Sleep ---
    if (sleep) {
      const shadow = localSleepShadow(day ?? ({} as WhoopDayRecord))
      if (sleep.sleepMinutes != null && shadow.minutes != null && shadow.minutes > 0) {
        registriereCalibrationPair(
          date,
          'sleep_minutes',
          shadow.minutes * params.sleepMinutesScale,
          sleep.sleepMinutes,
        )
      }
      if (sleep.sleepScore != null && shadow.score != null && shadow.score > 0) {
        registriereCalibrationPair(date, 'sleep_score', shadow.score, sleep.sleepScore)
      }
      if (sleep.sleepEfficiency != null && shadow.efficiency != null && shadow.efficiency > 0) {
        registriereCalibrationPair(date, 'sleep_efficiency', shadow.efficiency, sleep.sleepEfficiency)
      }
    }

    // --- Steps ---
    if (cycle?.steps != null && cycle.steps > 0 && day?.steps != null && day.steps > 0) {
      const localSteps = day.stepsFromCloud ? null : day.steps * params.stepsScale
      if (localSteps != null) {
        registriereCalibrationPair(date, 'steps', localSteps, cycle.steps)
      }
    }

    // --- Calories ---
    if (cycle?.calories != null && cycle.calories > 0) {
      let localCal: number | null = null
      if (day?.calories != null && !day.caloriesFromCloud) {
        localCal = day.calories * params.caloriesScale
      } else if (day?.avgHr != null && day.avgHr > 50) {
        const profil = ladeFitnessProfil()
        // Grobe Tageskalorien aus Ø-HF × ~16 Wachstunden
        localCal =
          kalorienDelta(
            day.avgHr,
            16 * 3600,
            profilGewichtKg(profil) || 75,
            profilAlter(profil),
            profilMaennlich(profil),
          ) * params.caloriesScale
      }
      if (localCal != null && localCal > 200) {
        registriereCalibrationPair(date, 'calories', localCal, cycle.calories)
      }
    }
  }

  // --- VO₂ (ein Wert, nicht pro Tag) ---
  const whoopVo2 =
    payload.vo2Max ??
    payload.bff?.monthlyAvgs.vo2Max ??
    [...(payload.bff?.daily ?? [])]
      .filter((d) => d.vo2Max != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)?.vo2Max
  const localVo2 = berechneVo2MaxAusWhoopVitals({
    restingHrs: payload.recoveries.map((r) => r.restingHr),
    maxHr: payload.body?.maxHr ?? null,
    cycleMaxHrs: payload.cycles.map((c) => c.maxHr),
  })
  if (whoopVo2 != null && localVo2 != null) {
    const heute = [...dates].sort().at(-1) ?? new Date().toISOString().slice(0, 10)
    registriereCalibrationPair(heute, 'vo2max', localVo2 * params.vo2Scale, whoopVo2)
  }

  // Auto-Fit wenn genug Paare
  autoFitCalibrationParams(7)
}
