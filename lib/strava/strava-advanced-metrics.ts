/** Strava — Phase 2: Dekoupling, VI, Heatmap, Gear-Split. */

import { istRadAktivitaet, leistungWatts, wattProKg } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

/** HR-Drift 2. vs. 1. Hälfte bei ähnlicher Leistung (positiv = schlechtere Effizienz). */
export function berechneAerobicDecoupling(
  watts: number[],
  hr: number[],
  time: number[],
): number | null {
  if (watts.length < 120 || hr.length !== watts.length || time.length !== watts.length) return null

  const t0 = time[0]
  const tEnd = time[time.length - 1]
  const mid = t0 + (tEnd - t0) / 2

  let w1 = 0
  let h1 = 0
  let c1 = 0
  let w2 = 0
  let h2 = 0
  let c2 = 0

  for (let i = 0; i < watts.length; i++) {
    if (watts[i] <= 0 || hr[i] <= 0) continue
    if (time[i] < mid) {
      w1 += watts[i]
      h1 += hr[i]
      c1++
    } else {
      w2 += watts[i]
      h2 += hr[i]
      c2++
    }
  }

  if (c1 < 60 || c2 < 60) return null
  const avgW1 = w1 / c1
  const avgW2 = w2 / c2
  const avgH1 = h1 / c1
  const avgH2 = h2 / c2
  if (avgW1 <= 0 || avgH2 <= 0) return null
  if (Math.abs(avgW1 - avgW2) / avgW1 > 0.12) return null

  return Math.round((avgH2 / avgH1 - 1) * 1000) / 10
}

export function berechneVariabilityIndex(
  weighted: number | null | undefined,
  average: number | null | undefined,
): number | null {
  if (weighted == null || average == null || average <= 0 || weighted <= 0) return null
  return Math.round((weighted / average) * 1000) / 1000
}

export function viAusAktivitaet(a: StravaActivityRow): number | null {
  if (a.variability_index != null && a.variability_index > 0) return a.variability_index
  return berechneVariabilityIndex(a.weighted_avg_watts, a.average_watts)
}

export type HeatmapCell = {
  day: number
  weekIndex: number
  label: string
  hours: number
  tss: number
  rides: number
  intensity: number
}

export type TrainingHeatmap = {
  weeks: number
  cells: HeatmapCell[]
  maxHours: number
}

export function berechneTrainingsHeatmap(
  activities: StravaActivityRow[],
  weeks = 12,
): TrainingHeatmap {
  const rides = activities.filter(istRadAktivitaet)
  const now = new Date()
  const cells: HeatmapCell[] = []
  let maxHours = 0

  for (let w = weeks - 1; w >= 0; w--) {
    for (let day = 0; day < 7; day++) {
      const ref = new Date(now)
      ref.setDate(ref.getDate() - w * 7 - (6 - day))
      ref.setHours(0, 0, 0, 0)
      const end = new Date(ref)
      end.setHours(23, 59, 59, 999)

      const dayRows = rides.filter((a) => {
        const ms = Date.parse(a.start_date)
        return ms >= ref.getTime() && ms <= end.getTime()
      })

      const hours = dayRows.reduce((s, a) => s + a.moving_time_s, 0) / 3600
      const tss = dayRows.reduce((s, a) => s + (a.estimated_tss ?? 0), 0)
      maxHours = Math.max(maxHours, hours)

      cells.push({
        day,
        weekIndex: weeks - 1 - w,
        label: ref.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
        hours: Math.round(hours * 10) / 10,
        tss: Math.round(tss),
        rides: dayRows.length,
        intensity: 0,
      })
    }
  }

  for (const c of cells) {
    c.intensity = maxHours > 0 ? c.hours / maxHours : 0
  }

  return { weeks, cells, maxHours }
}

export type GearStat = {
  gearId: number
  label: string
  rides: number
  km: number
  hours: number
  avgWatts: number | null
  avgWkg: number | null
}

export function berechneGearSplit(
  activities: StravaActivityRow[],
  weightKg: number | null,
): GearStat[] {
  const rides = activities.filter(istRadAktivitaet)
  const map = new Map<number, StravaActivityRow[]>()

  for (const a of rides) {
    const gid = a.gear_id ?? 0
    const list = map.get(gid) ?? []
    list.push(a)
    map.set(gid, list)
  }

  return [...map.entries()]
    .map(([gearId, list]) => {
      const km = list.reduce((s, a) => s + a.distance_m, 0) / 1000
      const hours = list.reduce((s, a) => s + a.moving_time_s, 0) / 3600
      const watts = list.map((a) => leistungWatts(a)).filter((w): w is number => w != null && w > 0)
      const avgW = watts.length ? Math.round(watts.reduce((s, v) => s + v, 0) / watts.length) : null
      const wkgVals = watts.map((w) => wattProKg(w, weightKg)).filter((v): v is number => v != null)
      const avgWkg =
        wkgVals.length > 0
          ? Math.round((wkgVals.reduce((s, v) => s + v, 0) / wkgVals.length) * 100) / 100
          : null
      return {
        gearId,
        label: gearId === 0 ? 'Unbekannt / kein Bike' : `Bike #${gearId}`,
        rides: list.length,
        km: Math.round(km),
        hours: Math.round(hours * 10) / 10,
        avgWatts: avgW,
        avgWkg,
      }
    })
    .sort((a, b) => b.km - a.km)
}

export type DecouplingTrendPoint = {
  label: string
  date: string
  decouplingPct: number | null
  vi: number | null
  activityId: number
  name: string
}

export function berechneDecouplingTrend(
  activities: StravaActivityRow[],
  limit = 20,
): DecouplingTrendPoint[] {
  return activities
    .filter(
      (a) =>
        istRadAktivitaet(a) &&
        a.moving_time_s >= 45 * 60 &&
        (a.aerobic_decoupling_pct != null || viAusAktivitaet(a) != null),
    )
    .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))
    .slice(-limit)
    .map((a) => ({
      label: new Date(a.start_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }),
      date: a.start_date,
      decouplingPct: a.aerobic_decoupling_pct ?? null,
      vi: viAusAktivitaet(a),
      activityId: a.strava_id,
      name: a.name,
    }))
}

export type AdvancedMetrics = {
  heatmap: TrainingHeatmap
  gearSplit: GearStat[]
  decouplingTrend: DecouplingTrendPoint[]
  avgDecoupling: number | null
  avgVi: number | null
  decouplingBacklog: number
}

export function berechneAdvancedMetrics(
  activities: StravaActivityRow[],
  weightKg: number | null,
): AdvancedMetrics {
  const rides = activities.filter(istRadAktivitaet)
  const withDec = rides.filter((a) => a.aerobic_decoupling_pct != null)
  const withVi = rides.filter((a) => viAusAktivitaet(a) != null)

  return {
    heatmap: berechneTrainingsHeatmap(activities),
    gearSplit: berechneGearSplit(activities, weightKg),
    decouplingTrend: berechneDecouplingTrend(activities),
    avgDecoupling:
      withDec.length > 0
        ? Math.round(
            (withDec.reduce((s, a) => s + (a.aerobic_decoupling_pct ?? 0), 0) / withDec.length) * 10,
          ) / 10
        : null,
    avgVi:
      withVi.length > 0
        ? Math.round((withVi.reduce((s, a) => s + (viAusAktivitaet(a) ?? 0), 0) / withVi.length) * 1000) /
          1000
        : null,
    decouplingBacklog: rides.filter(
      (a) =>
        a.moving_time_s >= 45 * 60 &&
        (a.device_watts || a.average_watts) &&
        a.aerobic_decoupling_pct == null &&
        a.power_peaks,
    ).length,
  }
}

export type AnalyticsFilter = {
  rangeDays: number | null
  ridesOnly: boolean
  outdoorOnly: boolean
}

export function filterActivities(
  activities: StravaActivityRow[],
  filter: AnalyticsFilter,
): StravaActivityRow[] {
  let out = activities
  if (filter.ridesOnly) {
    out = out.filter(istRadAktivitaet)
  }
  if (filter.outdoorOnly) {
    out = out.filter((a) => a.sport_type !== 'VirtualRide' && a.type !== 'VirtualRide')
  }
  if (filter.rangeDays != null && filter.rangeDays > 0) {
    const cutoff = Date.now() - filter.rangeDays * 86400_000
    out = out.filter((a) => Date.parse(a.start_date) >= cutoff)
  }
  return out
}

export function activitiesToCsv(
  activities: StravaActivityRow[],
  weightKg: number | null = null,
): string {
  const headers = [
    'datum',
    'name',
    'sport',
    'km',
    'zeit_min',
    'hm',
    'avg_watts',
    'wkg',
    'avg_hr',
    'tss',
    'temp_c',
    'decoupling_pct',
    'vi',
  ]
  const rows = activities.filter(istRadAktivitaet).map((a) => {
    const w = leistungWatts(a)
    const wkg = w != null ? wattProKg(w, weightKg) : null
    return [
      a.start_date.slice(0, 10),
      `"${a.name.replace(/"/g, '""')}"`,
      a.sport_type,
      (a.distance_m / 1000).toFixed(2),
      Math.round(a.moving_time_s / 60),
      Math.round(a.elevation_gain_m ?? 0),
      w ?? '',
      wkg != null ? wkg.toFixed(2) : '',
      a.average_heartrate ?? '',
      a.estimated_tss != null ? Math.round(a.estimated_tss) : '',
      a.weather_temp_c ?? '',
      a.aerobic_decoupling_pct ?? '',
      viAusAktivitaet(a) ?? '',
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}
