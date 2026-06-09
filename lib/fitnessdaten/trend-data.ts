/** Trend-Daten für Woche / Monat / 6 Monate. */

import {
  baseline30,
  ladeDailyStore,
  type WhoopDayRecord,
} from '@/lib/fitnessdaten/daily-records'
import { schaetzeVo2Max } from '@/lib/fitnessdaten/vo2max'
import { profilAlter, ladeFitnessProfil } from '@/lib/fitnessdaten/user-profile'
import type { MetricInfoId } from '@/lib/fitnessdaten/metric-explanations'

export type TrendZeitraum = 'woche' | 'monat' | '6monate'

export type HomeMetricId =
  | 'avg_hr'
  | 'rhr'
  | 'respiratory'
  | 'hrv'
  | 'vo2max'
  | 'steps'
  | 'calories'

export const HOME_METRICS: {
  id: HomeMetricId
  label: string
  unit: string
  infoId: MetricInfoId
  decimals?: number
}[] = [
  { id: 'avg_hr', label: 'Ø Herzfrequenz', unit: 'bpm', infoId: 'avg_hr' },
  { id: 'rhr', label: 'Ruheherzfrequenz', unit: 'bpm', infoId: 'rhr' },
  { id: 'respiratory', label: 'Atemfrequenz', unit: 'AZ/min', infoId: 'respiratory', decimals: 1 },
  { id: 'hrv', label: 'HFV', unit: 'ms', infoId: 'hrv' },
  { id: 'vo2max', label: 'VO₂ Max', unit: 'ml/kg/min', infoId: 'vo2max' },
  { id: 'steps', label: 'Schritte', unit: '', infoId: 'steps' },
  { id: 'calories', label: 'Kalorien', unit: 'kcal', infoId: 'calories' },
]

export function tageFuerZeitraum(zeitraum: TrendZeitraum): WhoopDayRecord[] {
  const n = zeitraum === 'woche' ? 7 : zeitraum === 'monat' ? 30 : 180
  return ladeDailyStore().days.slice(-n)
}

function wertFuerMetrik(d: WhoopDayRecord, id: HomeMetricId, age: number): number {
  switch (id) {
    case 'avg_hr':
      return d.avgHr ?? 0
    case 'rhr':
      return d.restingHr ?? 0
    case 'respiratory':
      return d.respiratoryRate ?? 0
    case 'hrv':
      return d.hrvRmssd ?? 0
    case 'vo2max':
      return d.vo2Max ?? schaetzeVo2Max(d.restingHr, d.maxHr, age) ?? 0
    case 'steps':
      return d.steps ?? 0
    case 'calories':
      return d.calories ?? 0
    default:
      return 0
  }
}

function tagLabel(iso: string, zeitraum: TrendZeitraum, index: number, total: number): string {
  const d = new Date(iso + 'T12:00:00')
  if (zeitraum === 'woche') {
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' })
  }
  if (zeitraum === 'monat') {
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })
  }
  if (total > 60 && index % 14 !== 0 && index !== total - 1) return ''
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

export function trendPunkte(
  metricId: HomeMetricId,
  zeitraum: TrendZeitraum,
): { label: string; value: number; highlight?: boolean }[] {
  const age = profilAlter(ladeFitnessProfil())
  const tage = tageFuerZeitraum(zeitraum)
  return tage.map((d, i) => ({
    label: tagLabel(d.date, zeitraum, i, tage.length),
    value: wertFuerMetrik(d, metricId, age),
    highlight: i === tage.length - 1,
  }))
}

export function heuteWert(metricId: HomeMetricId, heute: WhoopDayRecord): number | null {
  const age = profilAlter(ladeFitnessProfil())
  const v = wertFuerMetrik(heute, metricId, age)
  return v > 0 ? v : null
}

export function formatMetricWert(
  metricId: HomeMetricId,
  value: number | null,
  decimals = 0,
): string {
  if (value == null || value <= 0) return '—'
  if (metricId === 'steps' || metricId === 'calories') {
    return Math.round(value).toLocaleString('de-DE')
  }
  if (decimals > 0) return value.toFixed(decimals).replace('.', ',')
  return String(Math.round(value))
}

export function baselineFuerMetrik(metricId: HomeMetricId): number | null {
  const map: Record<HomeMetricId, keyof WhoopDayRecord> = {
    avg_hr: 'avgHr',
    rhr: 'restingHr',
    respiratory: 'respiratoryRate',
    hrv: 'hrvRmssd',
    vo2max: 'vo2Max',
    steps: 'steps',
    calories: 'calories',
  }
  return baseline30(map[metricId])
}
