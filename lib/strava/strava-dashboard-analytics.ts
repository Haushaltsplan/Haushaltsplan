/** Strava — Dashboard-Aggregationen (KPIs, Charts, Zonen). */

import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import {
  sportKind,
  sportLabel,
  type StravaSportKind,
  type TransformedStravaActivity,
  transformActivities,
} from '@/lib/strava/strava-activity-utils'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type KpiPeriod = 'week' | 'month' | 'quarter' | 'ytd'

export type KpiMetric = {
  key: 'distance' | 'time' | 'elevation' | 'count'
  label: string
  value: string
  raw: number
  unit: string
  changePct: number | null
  changeLabel: string
}

export type WeeklyVolumeBar = {
  label: string
  weekStart: string
  rideKm: number
  runKm: number
  otherKm: number
  totalKm: number
  rideTimeH: number
  runTimeH: number
}

export type ZoneSlice = {
  key: string
  label: string
  color: string
  minutes: number
  pct: number
}

export type SpeedTrendPoint = {
  label: string
  date: string
  activityId: number
  name: string
  value: number
  valueLabel: string
  distanceLabel: string
  timeLabel: string
  hrLabel: string
}

export type StravaDashboardAnalytics = {
  period: KpiPeriod
  kpis: KpiMetric[]
  weeklyVolume: WeeklyVolumeBar[]
  zoneDistribution: ZoneSlice[]
  zoneMode: 'hr' | 'sport'
  speedTrend: SpeedTrendPoint[]
  activities: TransformedStravaActivity[]
}

const ZONE_DEFS = [
  { key: 'z1', label: 'Zone 1', color: '#3b82f6', minPct: 0, maxPct: 60 },
  { key: 'z2', label: 'Zone 2', color: '#22c55e', minPct: 60, maxPct: 70 },
  { key: 'z3', label: 'Zone 3', color: '#eab308', minPct: 70, maxPct: 80 },
  { key: 'z4', label: 'Zone 4', color: '#f97316', minPct: 80, maxPct: 90 },
  { key: 'z5', label: 'Zone 5', color: '#ef4444', minPct: 90, maxPct: 101 },
] as const

const SPORT_COLORS: Record<StravaSportKind, string> = {
  ride: '#FC4C02',
  run: '#22d3ee',
  other: '#a78bfa',
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function endOfWeek(weekStart: Date): Date {
  const x = new Date(weekStart)
  x.setDate(x.getDate() + 6)
  x.setHours(23, 59, 59, 999)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function inRange(ms: number, from: Date, to: Date): boolean {
  return ms >= from.getTime() && ms <= to.getTime()
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return null
  if (previous <= 0) return 100
  return ((current - previous) / previous) * 100
}

function aggregate(rows: StravaActivityRow[]) {
  const km = rows.reduce((s, a) => s + a.distance_m, 0) / 1000
  const timeH = rows.reduce((s, a) => s + a.moving_time_s, 0) / 3600
  const hm = rows.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)
  return { km, timeH, hm, count: rows.length }
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

function buildKpis(rows: StravaActivityRow[], period: KpiPeriod, now = new Date()): KpiMetric[] {
  const all = rows.filter(istRadAktivitaet)
  let curFrom: Date
  let curTo: Date
  let prevFrom: Date
  let prevTo: Date
  let compareLabel: string

  if (period === 'week') {
    curFrom = startOfWeek(now)
    curTo = endOfWeek(curFrom)
    prevTo = new Date(curFrom.getTime() - 1)
    prevFrom = startOfWeek(prevTo)
    prevTo = endOfWeek(prevFrom)
    compareLabel = 'vs. Vorwoche'
  } else if (period === 'month') {
    curFrom = startOfMonth(now)
    curTo = endOfMonth(now)
    prevTo = new Date(curFrom.getTime() - 1)
    prevFrom = startOfMonth(prevTo)
    prevTo = endOfMonth(prevTo)
    compareLabel = 'vs. Vormonat'
  } else if (period === 'quarter') {
    curFrom = startOfQuarter(now)
    curTo = endOfQuarter(now)
    prevTo = new Date(curFrom.getTime() - 1)
    prevFrom = startOfQuarter(prevTo)
    prevTo = endOfQuarter(prevTo)
    compareLabel = 'vs. Vorquartal'
  } else {
    curFrom = startOfYear(now)
    curTo = now
    const prevYear = now.getFullYear() - 1
    prevFrom = new Date(prevYear, 0, 1)
    prevTo = new Date(prevYear, now.getMonth(), now.getDate(), 23, 59, 59, 999)
    compareLabel = 'vs. Vorjahr YTD'
  }

  const cur = all.filter((a) => inRange(Date.parse(a.start_date), curFrom, curTo))
  const prev = all.filter((a) => inRange(Date.parse(a.start_date), prevFrom, prevTo))
  const c = aggregate(cur)
  const p = aggregate(prev)

  const mk = (
    key: KpiMetric['key'],
    label: string,
    value: string,
    raw: number,
    unit: string,
    curVal: number,
    prevVal: number,
  ): KpiMetric => {
    const change = pctChange(curVal, prevVal)
    return {
      key,
      label,
      value,
      raw,
      unit,
      changePct: change,
      changeLabel: change == null ? `— ${compareLabel}` : `${change >= 0 ? '+' : ''}${change.toFixed(1)}% ${compareLabel}`,
    }
  }

  return [
    mk(
      'distance',
      'Distanz',
      `${c.km.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`,
      c.km,
      'km',
      c.km,
      p.km,
    ),
    mk(
      'time',
      'Trainingszeit',
      c.timeH >= 1
        ? `${Math.floor(c.timeH)} h ${Math.round((c.timeH % 1) * 60)} min`
        : `${Math.round(c.timeH * 60)} min`,
      c.timeH,
      'h',
      c.timeH,
      p.timeH,
    ),
    mk(
      'elevation',
      'Höhenmeter',
      `${Math.round(c.hm).toLocaleString('de-DE')} m`,
      c.hm,
      'm',
      c.hm,
      p.hm,
    ),
    mk('count', 'Aktivitäten', String(c.count), c.count, '', c.count, p.count),
  ]
}

function buildWeeklyVolume(rows: StravaActivityRow[], weeks = 12, now = new Date()): WeeklyVolumeBar[] {
  const rides = rows.filter(istRadAktivitaet)
  const buckets: WeeklyVolumeBar[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const ref = new Date(now)
    ref.setDate(ref.getDate() - i * 7)
    const ws = startOfWeek(ref)
    const we = endOfWeek(ws)
    const label = ws.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
    const weekRows = rides.filter((a) => inRange(Date.parse(a.start_date), ws, we))

    let rideKm = 0
    let runKm = 0
    let otherKm = 0
    let rideTimeH = 0
    let runTimeH = 0

    for (const a of weekRows) {
      const km = a.distance_m / 1000
      const h = a.moving_time_s / 3600
      const kind = sportKind(a.type, a.sport_type)
      if (kind === 'ride') {
        rideKm += km
        rideTimeH += h
      } else if (kind === 'run') {
        runKm += km
        runTimeH += h
      } else {
        otherKm += km
      }
    }

    buckets.push({
      label,
      weekStart: ws.toISOString(),
      rideKm,
      runKm,
      otherKm,
      totalKm: rideKm + runKm + otherKm,
      rideTimeH,
      runTimeH,
    })
  }

  return buckets
}

function hrPct(avgHr: number, maxHr: number): number {
  return (avgHr / maxHr) * 100
}

function zoneKeyFromHrPct(pct: number): (typeof ZONE_DEFS)[number]['key'] {
  for (const z of ZONE_DEFS) {
    if (pct >= z.minPct && pct < z.maxPct) return z.key
  }
  return 'z5'
}

function buildHrZoneDistribution(rows: StravaActivityRow[], maxHr: number | null): ZoneSlice[] {
  const withHr = rows.filter(
    (a) => istRadAktivitaet(a) && a.average_heartrate != null && a.average_heartrate > 0,
  )
  const effectiveMax = maxHr && maxHr > 0 ? maxHr : 190
  const minutes: Record<string, number> = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }

  for (const a of withHr) {
    const pct = hrPct(a.average_heartrate!, effectiveMax)
    const key = zoneKeyFromHrPct(pct)
    minutes[key] += a.moving_time_s / 60
  }

  const total = Object.values(minutes).reduce((s, v) => s + v, 0)
  return ZONE_DEFS.map((z) => ({
    key: z.key,
    label: z.label,
    color: z.color,
    minutes: minutes[z.key],
    pct: total > 0 ? (minutes[z.key] / total) * 100 : 0,
  }))
}

function buildSportDistribution(rows: StravaActivityRow[]): ZoneSlice[] {
  const rides = rows.filter(istRadAktivitaet)
  const minutes: Record<StravaSportKind, number> = { ride: 0, run: 0, other: 0 }

  for (const a of rides) {
    const kind = sportKind(a.type, a.sport_type)
    minutes[kind] += a.moving_time_s / 60
  }

  const total = minutes.ride + minutes.run + minutes.other
  return (['ride', 'run', 'other'] as StravaSportKind[]).map((kind) => ({
    key: kind,
    label: sportLabel(kind),
    color: SPORT_COLORS[kind],
    minutes: minutes[kind],
    pct: total > 0 ? (minutes[kind] / total) * 100 : 0,
  }))
}

function buildSpeedTrend(rows: StravaActivityRow[], limit = 20): SpeedTrendPoint[] {
  const rides = rows
    .filter((a) => istRadAktivitaet(a) && a.moving_time_s >= 20 * 60 && a.distance_m >= 5000)
    .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))
    .slice(-limit)

  const transformed = transformActivities(rides)

  return transformed.map((a) => ({
    label: new Date(a.startDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
    date: a.startDate,
    activityId: a.id,
    name: a.name,
    value: a.speedOrPaceValue ?? 0,
    valueLabel: a.speedOrPaceLabel,
    distanceLabel: a.distanceLabel,
    timeLabel: a.movingTimeCompact,
    hrLabel: a.avgHrLabel,
  }))
}

export function berechneStravaDashboardAnalytics(
  activities: StravaActivityRow[],
  opts: { period?: KpiPeriod; maxHr?: number | null } = {},
): StravaDashboardAnalytics {
  const period = opts.period ?? 'week'
  const rides = activities.filter(istRadAktivitaet)
  const withHr = rides.some((a) => a.average_heartrate != null && a.average_heartrate > 0)
  const zoneDistribution = withHr
    ? buildHrZoneDistribution(rides, opts.maxHr ?? null)
    : buildSportDistribution(rides)

  return {
    period,
    kpis: buildKpis(activities, period),
    weeklyVolume: buildWeeklyVolume(activities),
    zoneDistribution,
    zoneMode: withHr ? 'hr' : 'sport',
    speedTrend: buildSpeedTrend(activities),
    activities: transformActivities(
      [...rides].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date)).slice(0, 30),
    ),
  }
}

export { SPORT_COLORS, ZONE_DEFS }
