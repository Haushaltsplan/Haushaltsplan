/**
 * Dual-Lauf: lokale Shadow-Engines vs Whoop-Cloud-Sollwerte nach Sync.
 * UI bleibt Cloud-autoritativ (außer omniaOfflineMode).
 */

import {
  autoFitCalibrationParams,
  registriereCalibrationPair,
} from '@/lib/fitnessdaten/calibration/calibration-log'
import { ladeCalibrationParams } from '@/lib/fitnessdaten/calibration/calibration-params'
import { ladeDailyStore } from '@/lib/fitnessdaten/daily-records'
import { recoveryAusBaseline } from '@/lib/fitnessdaten/scores'
import { berechneSchlafbedarf, schaetzeRemTief } from '@/lib/fitnessdaten/sleep-detail'
import { berechneVo2MaxAusWhoopVitals } from '@/lib/fitnessdaten/vo2max-from-vitals'
import type { WhoopCloudSyncPayload } from '@/lib/fitnessdaten/whoop-cloud-types'
import { ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import { strainAusStrainLoad } from '@/lib/fitnessdaten/strain-engine'

function baselineAusHistoryOrDays(
  days: Array<{
    date: string
    hrvRmssd: number | null
    restingHr: number | null
    localHrv?: number | null
    localRhr?: number | null
  }>,
  historyBaselines: { hrvRmssdMs: number; restingHrBpm: number },
  excludeDate: string,
): { hrv: number; rhr: number } {
  const hrvVals = days
    .filter((d) => d.date !== excludeDate)
    .slice(-30)
    .map((d) => d.localHrv ?? d.hrvRmssd)
    .filter((v): v is number => v != null && v > 0)
  const rhrVals = days
    .filter((d) => d.date !== excludeDate)
    .slice(-30)
    .map((d) => d.localRhr ?? d.restingHr)
    .filter((v): v is number => v != null && v > 0)
  return {
    hrv:
      hrvVals.length >= 5
        ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length
        : historyBaselines.hrvRmssdMs,
    rhr:
      rhrVals.length >= 5
        ? rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length
        : historyBaselines.restingHrBpm,
  }
}

/**
 * Nach Cloud-Merge: echte Shadow-Werte (BLE) gegen Whoop paaren.
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
    const prevStrain =
      byDate.get(date)?.strain ??
      [...byDate.values()].filter((d) => d.date < date).at(-1)?.strain ??
      null

    // --- Strain: nur aus Shadow ---
    if (cycle?.strain != null && cycle.strain > 0) {
      let localStrain: number | null = null
      if (day?.localStrain != null && day.localStrain > 0) {
        localStrain = day.localStrain
      } else if (history.localStrainDate === date && history.localStrainLoad != null) {
        localStrain = strainAusStrainLoad(history.localStrainLoad)
      } else if (history.localStrainDate === date && history.localStrain != null && history.localStrain > 0) {
        localStrain = history.localStrain
      }
      if (localStrain != null && localStrain > 0) {
        registriereCalibrationPair(date, 'strain', localStrain, cycle.strain, 'shadow')
      }
    }

    if (cycle?.avgHr != null && day?.avgHr != null && !day.bffMetrics) {
      registriereCalibrationPair(date, 'avg_hr', day.avgHr, cycle.avgHr, 'shadow')
    }

    // --- Recovery ---
    if (rec?.recoveryPercent != null) {
      const localHrv = day?.localHrv ?? (history.localRecoveryDate === date ? history.localHrv : null)
      const localRhr = day?.localRhr ?? (history.localRecoveryDate === date ? history.localRhr : null)
      const localRecPct =
        day?.localRecoveryPercent ??
        (history.localRecoveryDate === date ? history.localRecoveryPercent : null)
      const sleepPerf = day?.localSleepScore ?? day?.sleepScore ?? null

      if (localRecPct != null && localRecPct > 0) {
        registriereCalibrationPair(date, 'recovery', localRecPct, rec.recoveryPercent, 'shadow')
      } else if (localHrv != null && localRhr != null) {
        const base = baselineAusHistoryOrDays(store.days, history.baselines, date)
        const local = recoveryAusBaseline(localHrv, localRhr, base.hrv, base.rhr, sleepPerf)
        if (local) {
          registriereCalibrationPair(date, 'recovery', local.percent, rec.recoveryPercent, 'shadow')
        }
      }
    }

    if (rec?.restingHr != null && day?.localRhr != null) {
      registriereCalibrationPair(date, 'rhr', day.localRhr, rec.restingHr, 'shadow')
    }
    if (rec?.hrvRmssd != null && day?.localHrv != null) {
      registriereCalibrationPair(date, 'hrv', day.localHrv, rec.hrvRmssd, 'shadow')
    }

    if (rec?.spo2Percent != null && day?.spo2Percent != null) {
      // SpO₂ kommt nur aus Cloud — Paar nur zur Dokumentation (kein lokaler Sensor)
      registriereCalibrationPair(date, 'spo2', day.spo2Percent, rec.spo2Percent, 'echo')
    }

    if (rec?.skinTempC != null && day?.skinTempC != null && day.skinTempC > 0) {
      // Gen5-Skin vs Cloud — wenn unterschiedlich genug als shadow, sonst formula
      const src =
        Math.abs(day.skinTempC - rec.skinTempC) > 0.01 ? 'shadow' : 'echo'
      registriereCalibrationPair(date, 'skin_temp', day.skinTempC, rec.skinTempC, src)
    }

    if (sleep?.respiratoryRate != null && day?.localRespiratoryRate != null) {
      registriereCalibrationPair(
        date,
        'respiratory',
        day.localRespiratoryRate,
        sleep.respiratoryRate,
        'shadow',
      )
    }

    if (sleep) {
      if (sleep.sleepMinutes != null && day?.localSleepMinutes != null && day.localSleepMinutes > 0) {
        registriereCalibrationPair(
          date,
          'sleep_minutes',
          day.localSleepMinutes,
          sleep.sleepMinutes,
          'shadow',
        )
      }
      if (sleep.sleepScore != null && day?.localSleepScore != null && day.localSleepScore > 0) {
        registriereCalibrationPair(date, 'sleep_score', day.localSleepScore, sleep.sleepScore, 'shadow')
      }
      if (
        sleep.sleepEfficiency != null &&
        day?.localSleepEfficiency != null &&
        day.localSleepEfficiency > 0
      ) {
        registriereCalibrationPair(
          date,
          'sleep_efficiency',
          day.localSleepEfficiency,
          sleep.sleepEfficiency,
          'shadow',
        )
      }

      // Sleep need: lokale Formel vs Cloud
      if (sleep.sleepNeedMinutes != null && sleep.sleepNeedMinutes > 0) {
        const defizit = Math.max(0, 480 - (day?.localSleepMinutes ?? day?.sleepMinutes ?? 0))
        const localNeed =
          day?.localSleepNeedMinutes ?? berechneSchlafbedarf(prevStrain ?? cycle?.strain ?? null, defizit)
        registriereCalibrationPair(date, 'sleep_need', localNeed, sleep.sleepNeedMinutes, 'shadow')
      }

      // Stages: fitted ratios vs Cloud
      if (sleep.remMinutes != null && sleep.sleepMinutes != null && sleep.sleepMinutes > 0) {
        const localRem =
          day?.localRemMinutes ??
          schaetzeRemTief(day?.localSleepMinutes ?? sleep.sleepMinutes).rem
        registriereCalibrationPair(date, 'sleep_rem', localRem, sleep.remMinutes, 'shadow')
      }
      if (sleep.deepMinutes != null && sleep.sleepMinutes != null && sleep.sleepMinutes > 0) {
        const localDeep =
          day?.localDeepMinutes ??
          schaetzeRemTief(day?.localSleepMinutes ?? sleep.sleepMinutes).deep
        registriereCalibrationPair(date, 'sleep_deep', localDeep, sleep.deepMinutes, 'shadow')
      }

      if (sleep.sleepConsistency != null && day?.localSleepConsistency != null) {
        registriereCalibrationPair(
          date,
          'sleep_consistency',
          day.localSleepConsistency,
          sleep.sleepConsistency,
          'shadow',
        )
      }
    }

    if (cycle?.steps != null && cycle.steps > 0 && day?.localSteps != null && day.localSteps > 0) {
      registriereCalibrationPair(date, 'steps', day.localSteps, cycle.steps, 'shadow')
    }

    if (cycle?.calories != null && cycle.calories > 0 && day?.localCalories != null && day.localCalories > 200) {
      registriereCalibrationPair(date, 'calories', day.localCalories, cycle.calories, 'shadow')
    }
  }

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
    scale: params.vo2Scale,
  })
  if (whoopVo2 != null && localVo2 != null) {
    const heute = [...dates].sort().at(-1) ?? new Date().toISOString().slice(0, 10)
    registriereCalibrationPair(heute, 'vo2max', localVo2, whoopVo2, 'shadow')
  }

  autoFitCalibrationParams(7)
}
