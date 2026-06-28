/** Strava — Fortschritt & Entwicklung (Phase 1 Analytics). */

import { istRadAktivitaet, leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import { berechnePowerCurve, schaetzeEftp, type PowerCurvePoint } from '@/lib/strava/strava-power-curve'
import { POWER_PEAK_LABELS, type StravaPowerPeaks } from '@/lib/strava/strava-power'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type MonthlyProgressPoint = {
  label: string
  monthKey: string
  eftp: number | null
  avgWkg: number | null
  rides: number
  km: number
  tss: number
}

export type PrTimelineEntry = {
  key: keyof StravaPowerPeaks
  label: string
  watts: number
  wkg: number | null
  date: string
  dateLabel: string
  activityId: number
  activityName: string
  isRecent: boolean
}

export type QuarterlyCurve = {
  label: string
  quarterKey: string
  curve: PowerCurvePoint[]
  eftp: number | null
}

export type WeeklyTssBar = {
  label: string
  weekStart: string
  tss: number
  target: number
  rides: number
}

export type TssBudgetStats = {
  weeklyTarget: number
  weeks: WeeklyTssBar[]
  ytdTss: number
  ytdTarget: number
  onTrackPct: number | null
}

export type TssAdherence = {
  weeksTracked: number
  weeksOnTarget: number
  weeksUnder: number
  weeksOver: number
  adherencePct: number | null
  currentStreakOnTarget: number
  avgWeeklyTss: number | null
  bestWeek: { label: string; tss: number } | null
}

const PEAK_KEYS: (keyof StravaPowerPeaks)[] = [
  'max_1s',
  'avg_5s',
  'avg_1min',
  'avg_5min',
  'avg_20min',
  'avg_60min',
]

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function quarterKey(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

function quarterLabel(key: string): string {
  const [y, q] = key.split('-')
  return `${q} ${y}`
}

export function berechneMonatlichenFortschritt(
  activities: StravaActivityRow[],
  weightKg: number | null,
  months = 18,
): MonthlyProgressPoint[] {
  const rides = activities.filter(istRadAktivitaet)
  const now = new Date()
  const points: MonthlyProgressPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999)
    const key = monthKey(from)
    const monthRides = rides.filter((a) => {
      const ms = Date.parse(a.start_date)
      return ms >= from.getTime() && ms <= to.getTime()
    })

    const curve = berechnePowerCurve(monthRides, weightKg)
    const eftp = schaetzeEftp(curve)

    const wkgVals: number[] = []
    for (const a of monthRides) {
      const w = leistungWatts(a)
      if (w == null || a.moving_time_s < 20 * 60) continue
      const wkg = wattProKg(w, weightKg)
      if (wkg != null) wkgVals.push(wkg)
    }
    const avgWkg =
      wkgVals.length > 0
        ? Math.round((wkgVals.reduce((s, v) => s + v, 0) / wkgVals.length) * 100) / 100
        : null

    const km = monthRides.reduce((s, a) => s + a.distance_m, 0) / 1000
    const tss = monthRides.reduce((s, a) => s + (a.estimated_tss ?? 0), 0)

    points.push({
      label: monthLabel(key),
      monthKey: key,
      eftp,
      avgWkg,
      rides: monthRides.length,
      km: Math.round(km),
      tss: Math.round(tss),
    })
  }

  return points
}

export function berechnePrTimeline(
  activities: StravaActivityRow[],
  weightKg: number | null,
): PrTimelineEntry[] {
  const rides = activities.filter(istRadAktivitaet)
  const recentCutoff = Date.now() - 90 * 86400_000
  const entries: PrTimelineEntry[] = []

  for (const key of PEAK_KEYS) {
    let bestW: number | null = null
    let bestA: StravaActivityRow | null = null
    for (const a of rides) {
      const peaks = a.power_peaks
      if (!peaks) continue
      const w = peaks[key]
      if (w != null && w > 0 && (bestW == null || w > bestW)) {
        bestW = w
        bestA = a
      }
    }
    if (bestW == null || !bestA) continue
    const ms = Date.parse(bestA.start_date)
    entries.push({
      key,
      label: POWER_PEAK_LABELS[key],
      watts: Math.round(bestW),
      wkg: wattProKg(bestW, weightKg),
      date: bestA.start_date,
      dateLabel: new Date(bestA.start_date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      activityId: bestA.strava_id,
      activityName: bestA.name,
      isRecent: ms >= recentCutoff,
    })
  }

  return entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export function berechneQuartalsPowerCurves(
  activities: StravaActivityRow[],
  weightKg: number | null,
  quarters = 4,
): QuarterlyCurve[] {
  const rides = activities.filter(istRadAktivitaet)
  const now = new Date()
  const keys: string[] = []

  for (let i = quarters - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i * 3, 1)
    keys.push(quarterKey(ref))
  }

  const uniqueKeys = [...new Set(keys)]

  return uniqueKeys.map((qk) => {
    const [yStr, qPart] = qk.split('-')
    const year = Number(yStr)
    const q = Number(qPart.replace('Q', ''))
    const from = new Date(year, (q - 1) * 3, 1)
    const to = new Date(year, q * 3, 0, 23, 59, 59, 999)

    const qRides = rides.filter((a) => {
      const ms = Date.parse(a.start_date)
      return ms >= from.getTime() && ms <= to.getTime()
    })

    const curve = berechnePowerCurve(qRides, weightKg)
    return {
      label: quarterLabel(qk),
      quarterKey: qk,
      curve,
      eftp: schaetzeEftp(curve),
    }
  })
}

export function berechneTssBudget(
  activities: StravaActivityRow[],
  goalTssWeek: number | null,
  weeks = 12,
): TssBudgetStats {
  const rides = activities.filter(istRadAktivitaet)
  const target = goalTssWeek != null && goalTssWeek > 0 ? goalTssWeek : 300
  const now = new Date()
  const bars: WeeklyTssBar[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const ref = new Date(now)
    ref.setDate(ref.getDate() - i * 7)
    const ws = startOfWeek(ref)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    we.setHours(23, 59, 59, 999)

    const weekRides = rides.filter((a) => {
      const ms = Date.parse(a.start_date)
      return ms >= ws.getTime() && ms <= we.getTime()
    })

    const tss = Math.round(weekRides.reduce((s, a) => s + (a.estimated_tss ?? 0), 0))
    bars.push({
      label: ws.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
      weekStart: ws.toISOString(),
      tss,
      target,
      rides: weekRides.length,
    })
  }

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const ytdRides = rides.filter((a) => Date.parse(a.start_date) >= yearStart.getTime())
  const ytdTss = Math.round(ytdRides.reduce((s, a) => s + (a.estimated_tss ?? 0), 0))

  const weekOfYear = Math.ceil(
    (now.getTime() - yearStart.getTime()) / (7 * 86400_000),
  )
  const ytdTarget = Math.round(target * Math.max(weekOfYear, 1))
  const onTrackPct = ytdTarget > 0 ? Math.round((ytdTss / ytdTarget) * 100) : null

  return { weeklyTarget: target, weeks: bars, ytdTss, ytdTarget, onTrackPct }
}

export function berechneTssAdherence(
  activities: StravaActivityRow[],
  goalTssWeek: number | null,
  weeks = 16,
): TssAdherence {
  const budget = berechneTssBudget(activities, goalTssWeek, weeks)
  const withRides = budget.weeks.filter((w) => w.rides > 0)
  const weeksOnTarget = withRides.filter((w) => w.tss >= w.target).length
  const weeksUnder = withRides.filter((w) => w.tss < w.target * 0.85).length
  const weeksOver = withRides.filter((w) => w.tss > w.target * 1.15).length

  let streak = 0
  for (let i = budget.weeks.length - 1; i >= 0; i--) {
    const w = budget.weeks[i]
    if (w.rides === 0) continue
    if (w.tss >= w.target) streak += 1
    else break
  }

  const tssVals = withRides.map((w) => w.tss)
  const avgWeeklyTss =
    tssVals.length > 0 ? Math.round(tssVals.reduce((s, v) => s + v, 0) / tssVals.length) : null

  let bestWeek: TssAdherence['bestWeek'] = null
  for (const w of withRides) {
    if (!bestWeek || w.tss > bestWeek.tss) bestWeek = { label: w.label, tss: w.tss }
  }

  return {
    weeksTracked: withRides.length,
    weeksOnTarget,
    weeksUnder,
    weeksOver,
    adherencePct:
      withRides.length > 0 ? Math.round((weeksOnTarget / withRides.length) * 100) : null,
    currentStreakOnTarget: streak,
    avgWeeklyTss,
    bestWeek,
  }
}

export type ProgressAnalytics = {
  monthly: MonthlyProgressPoint[]
  prTimeline: PrTimelineEntry[]
  quarterlyCurves: QuarterlyCurve[]
  tssBudget: TssBudgetStats
  tssAdherence: TssAdherence
}

export function berechneProgressAnalytics(
  activities: StravaActivityRow[],
  weightKg: number | null,
  goalTssWeek: number | null,
): ProgressAnalytics {
  return {
    monthly: berechneMonatlichenFortschritt(activities, weightKg),
    prTimeline: berechnePrTimeline(activities, weightKg),
    quarterlyCurves: berechneQuartalsPowerCurves(activities, weightKg),
    tssBudget: berechneTssBudget(activities, goalTssWeek),
    tssAdherence: berechneTssAdherence(activities, goalTssWeek),
  }
}
