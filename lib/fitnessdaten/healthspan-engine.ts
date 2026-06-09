/** WHOOP-Age / Healthspan — lokal aus BLE-Daten approximiert (kein Cloud-Modell). */

import { baseline30, letzte7Tage, type WhoopDayRecord } from '@/lib/fitnessdaten/daily-records'
import { ladeFitnessHistory } from '@/lib/fitnessdaten/history-storage'
import { ladeFitnessProfil, profilAlter } from '@/lib/fitnessdaten/user-profile'
import { schaetzeVo2Max } from '@/lib/fitnessdaten/vo2max'
import type { HrZoneMinutes } from '@/lib/fitnessdaten/types'

export type HealthspanMetricId =
  | 'sleep_consistency'
  | 'sleep_hours'
  | 'zones_13_weekly'
  | 'zones_45_weekly'
  | 'steps'
  | 'strength'
  | 'vo2max'
  | 'rhr'

export type HealthspanMetric = {
  id: HealthspanMetricId
  label: string
  value: string
  valueNum: number
  min: number
  max: number
  /** 0–1 Position auf der Skala (höher = besser, außer RHR invertiert) */
  position: number
  invertScale?: boolean
  impactYears: number
  insight?: string
  avg30?: string
}

export type HealthspanModel = {
  chronologicalAge: number
  whoopAge: number | null
  yearsYounger: number | null
  agingProcess: number | null
  agingTrend: 'slower' | 'faster' | 'stable'
  metrics: HealthspanMetric[]
  trendMonths: { label: string; whoopAge: number | null; chronoAge: number }[]
  agingTrendLine: { label: string; value: number }[]
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function posLinear(v: number, min: number, max: number, invert = false): number {
  const p = clamp01((v - min) / (max - min || 1))
  return invert ? 1 - p : p
}

function impactFromPosition(p: number, weight: number): number {
  return Math.round((0.5 - p) * weight * 10) / 10
}

function formatStdMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')} h`
}

function wochenSumme(field: keyof WhoopDayRecord, woche = letzte7Tage()): number {
  return woche.reduce((a, d) => {
    const v = d[field]
    return a + (typeof v === 'number' ? v : 0)
  }, 0)
}

export function baueHealthspanModel(heute: WhoopDayRecord): HealthspanModel {
  const history = ladeFitnessHistory()
  const age = profilAlter(ladeFitnessProfil())
  const woche = letzte7Tage()

  const consistency = heute.sleepConsistency ?? baseline30('sleepConsistency') ?? 70
  const sleepMin = heute.sleepMinutes ?? 0
  const zone13Week = wochenSumme('zoneMin13', woche)
  const zone45Week = wochenSumme('zoneMin45', woche)
  const stepsAvg = baseline30('steps', woche) ?? heute.steps ?? 0
  const strengthWeek = wochenSumme('strengthMin', woche)
  const rhr = heute.restingHr ?? history.baselines.restingHrBpm
  const vo2 = heute.vo2Max ?? schaetzeVo2Max(rhr, heute.maxHr, age)

  const metrics: HealthspanMetric[] = [
    {
      id: 'sleep_consistency',
      label: 'Schlafregelmäßigkeit',
      value: `${Math.round(consistency)} %`,
      valueNum: consistency,
      min: 40,
      max: 100,
      position: posLinear(consistency, 40, 100),
      impactYears: impactFromPosition(posLinear(consistency, 40, 100), 2),
    },
    {
      id: 'sleep_hours',
      label: 'Geschlafene Stunden',
      value: sleepMin > 0 ? formatStdMin(sleepMin) : '—',
      valueNum: sleepMin,
      min: 300,
      max: 480,
      position: posLinear(sleepMin, 300, 480),
      impactYears: impactFromPosition(posLinear(sleepMin, 300, 480), 1.5),
    },
    {
      id: 'zones_13_weekly',
      label: 'Zeit in HF-Zonen 1–3 (wöchentlich)',
      value: formatStdMin(zone13Week),
      valueNum: zone13Week,
      min: 0,
      max: 420,
      position: posLinear(zone13Week, 0, 420),
      impactYears: impactFromPosition(posLinear(zone13Week, 0, 420), 2),
      avg30: formatStdMin(wochenSumme('zoneMin13') * 4),
    },
    {
      id: 'zones_45_weekly',
      label: 'Zeit in HF-Zonen 4–5 (wöchentlich)',
      value: formatStdMin(zone45Week),
      valueNum: zone45Week,
      min: 0,
      max: 60,
      position: posLinear(zone45Week, 0, 45),
      impactYears: impactFromPosition(posLinear(zone45Week, 0, 45), 0.8),
      insight:
        zone45Week >= 30
          ? 'Überdurchschnittlich — moderate Zeit in hohen Zonen unterstützt langfristige Fitness.'
          : undefined,
      avg30: formatStdMin(wochenSumme('zoneMin45') * 4),
    },
    {
      id: 'strength',
      label: 'Kraftaktivitätszeit (wöchentlich)',
      value: formatStdMin(strengthWeek),
      valueNum: strengthWeek,
      min: 0,
      max: 120,
      position: posLinear(strengthWeek, 0, 120),
      impactYears: impactFromPosition(posLinear(strengthWeek, 0, 120), 1.8),
      insight:
        strengthWeek < 5
          ? 'Unter dem empfohlenen Bereich — mehr Krafttraining kann dein Omnia-Alter verbessern.'
          : undefined,
    },
    {
      id: 'steps',
      label: 'Schritte',
      value: `${Math.round(stepsAvg).toLocaleString('de-DE')} Schritte`,
      valueNum: stepsAvg,
      min: 0,
      max: 16000,
      position: posLinear(stepsAvg, 0, 16000),
      impactYears: impactFromPosition(posLinear(stepsAvg, 0, 16000), 1.6),
    },
  ]

  if (vo2 != null) {
    metrics.push({
      id: 'vo2max',
      label: 'VO₂ Max (geschätzt)',
      value: `${vo2} ml/kg/min`,
      valueNum: vo2,
      min: 15,
      max: 70,
      position: posLinear(vo2, 15, 70),
      impactYears: impactFromPosition(posLinear(vo2, 15, 70), 3.5),
    })
  }

  metrics.push({
    id: 'rhr',
    label: 'RHF',
    value: `${Math.round(rhr)} S/min`,
    valueNum: rhr,
    min: 40,
    max: 80,
    position: posLinear(rhr, 40, 80, true),
    invertScale: true,
    impactYears: impactFromPosition(posLinear(rhr, 40, 80, true), 2),
  })

  const totalImpact = metrics.reduce((a, m) => a + m.impactYears, 0)
  const whoopAge =
    metrics.length > 0 ? Math.round(Math.min(age + 5, Math.max(age - 8, age - totalImpact)) * 10) / 10 : null
  const yearsYounger = whoopAge != null ? Math.round((age - whoopAge) * 10) / 10 : null

  const recoveryAvg = baseline30('recoveryPercent') ?? 65
  const recoveryHeute = heute.recoveryPercent ?? recoveryAvg
  const agingProcess =
    recoveryHeute > 0
      ? Math.round(Math.min(2.5, Math.max(0.4, 1.2 - (recoveryHeute - recoveryAvg) / 100)) * 10) / 10
      : null

  const agingTrend: HealthspanModel['agingTrend'] =
    agingProcess != null && agingProcess < 0.85
      ? 'slower'
      : agingProcess != null && agingProcess > 1.15
        ? 'faster'
        : 'stable'

  const months = ['Jan', 'Feb', 'März', 'Apr', 'Mai']
  const trendMonths = months.map((label, i) => ({
    label,
    whoopAge: whoopAge != null && i >= 3 ? whoopAge + (4 - i) * 0.3 : null,
    chronoAge: i >= 3 ? age + (i - 3) * 0.02 : age,
  }))
  if (whoopAge != null && trendMonths[4]) trendMonths[4]!.whoopAge = whoopAge

  const agingTrendLine = months.map((label, i) => ({
    label,
    value: i < 3 ? 1 : i === 3 ? 1.1 : agingProcess ?? 1,
  }))

  return {
    chronologicalAge: age,
    whoopAge,
    yearsYounger,
    agingProcess,
    agingTrend,
    metrics,
    trendMonths,
    agingTrendLine,
  }
}

export function zoneSegmenteAusTag(d: WhoopDayRecord): {
  z13: { key: string; min: number; color: string }[]
  z45: { key: string; min: number; color: string }[]
} {
  const zm = d.zoneMinutes
  if (zm) {
    return {
      z13: [
        { key: 'z1', min: (zm.z1 ?? 0) * 60, color: '#93c5fd' },
        { key: 'z2', min: (zm.z2 ?? 0) * 60, color: '#3b82f6' },
        { key: 'z3', min: (zm.z3 ?? 0) * 60, color: '#14b8a6' },
      ],
      z45: [
        { key: 'z4', min: (zm.z4 ?? 0) * 60, color: '#fb923c' },
        { key: 'z5', min: (zm.z5 ?? 0) * 60, color: '#ea580c' },
      ],
    }
  }
  const t = d.zoneMin13 * 60
  const t45 = d.zoneMin45 * 60
  return {
    z13: [
      { key: 'z1', min: t * 0.5, color: '#93c5fd' },
      { key: 'z2', min: t * 0.35, color: '#3b82f6' },
      { key: 'z3', min: t * 0.15, color: '#14b8a6' },
    ],
    z45: [
      { key: 'z4', min: t45 * 0.6, color: '#fb923c' },
      { key: 'z5', min: t45 * 0.4, color: '#ea580c' },
    ],
  }
}

export function speichereZonenImTag(record: WhoopDayRecord, zoneMinutes: HrZoneMinutes | null | undefined): WhoopDayRecord {
  if (!zoneMinutes) return record
  return {
    ...record,
    zoneMinutes: { ...zoneMinutes },
    zoneMin13: (zoneMinutes.z1 ?? 0) + (zoneMinutes.z2 ?? 0) + (zoneMinutes.z3 ?? 0),
    zoneMin45: (zoneMinutes.z4 ?? 0) + (zoneMinutes.z5 ?? 0),
  }
}
