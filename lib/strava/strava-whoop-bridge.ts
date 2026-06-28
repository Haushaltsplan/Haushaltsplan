/** Strava × WHOOP — Recovery vs. geplante Belastung (Client-only). */

import { ladeDailyStore } from '@/lib/fitnessdaten/daily-records'
import { geschaetztesTss } from '@/lib/strava/strava-training-load'
import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type WhoopDayPoint = {
  date: string
  label: string
  recovery: number | null
  tss: number
}

export type WhoopLagPoint = {
  date: string
  label: string
  recovery: number
  tssPrev: number
}

export type WhoopStravaInsight = {
  hasWhoop: boolean
  recovery: number | null
  recoveryLabel: string | null
  weekTss: number
  recommendation: string
  color: string
  trend14d: WhoopDayPoint[]
  lag14d: WhoopLagPoint[]
  avgRecovery14d: number | null
  avgTss14d: number | null
  avgRecoveryAfterHighTss: number | null
  avgRecoveryAfterLowTss: number | null
  lagInsight: string | null
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}

function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function tagOffset(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return isoTag(d)
}

function tssAmTag(activities: StravaActivityRow[], date: string, ftp: number | null): number {
  return activities
    .filter((a) => istRadAktivitaet(a) && a.start_date.slice(0, 10) === date)
    .reduce((s, a) => s + geschaetztesTss(a, ftp), 0)
}

function berechneTrend14d(
  activities: StravaActivityRow[],
  ftp: number | null,
): WhoopDayPoint[] {
  const store = ladeDailyStore()
  const points: WhoopDayPoint[] = []
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)

  for (let i = 13; i >= 0; i--) {
    const d = new Date(heute)
    d.setDate(d.getDate() - i)
    const iso = isoTag(d)
    const whoop = store.days.find((x) => x.date === iso)
    points.push({
      date: iso,
      label: d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
      recovery: whoop?.recoveryPercent ?? null,
      tss: Math.round(tssAmTag(activities, iso, ftp)),
    })
  }
  return points
}

function berechneLag14d(
  activities: StravaActivityRow[],
  ftp: number | null,
): WhoopLagPoint[] {
  const store = ladeDailyStore()
  const points: WhoopLagPoint[] = []
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)

  for (let i = 13; i >= 0; i--) {
    const d = new Date(heute)
    d.setDate(d.getDate() - i)
    const iso = isoTag(d)
    const whoop = store.days.find((x) => x.date === iso)
    if (whoop?.recoveryPercent == null) continue
    const prev = tagOffset(iso, -1)
    points.push({
      date: iso,
      label: d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
      recovery: whoop.recoveryPercent,
      tssPrev: Math.round(tssAmTag(activities, prev, ftp)),
    })
  }
  return points
}

function lagStatistik(lag: WhoopLagPoint[]): {
  avgRecoveryAfterHighTss: number | null
  avgRecoveryAfterLowTss: number | null
  lagInsight: string | null
} {
  const high = lag.filter((p) => p.tssPrev >= 80)
  const low = lag.filter((p) => p.tssPrev > 0 && p.tssPrev < 40)
  const rest = lag.filter((p) => p.tssPrev === 0)

  const avg = (arr: WhoopLagPoint[]) =>
    arr.length > 0 ? Math.round(arr.reduce((s, p) => s + p.recovery, 0) / arr.length) : null

  const avgHigh = avg(high)
  const avgLow = avg(low.length > 0 ? low : rest)

  let lagInsight: string | null = null
  if (avgHigh != null && avgLow != null && high.length >= 2) {
    const diff = avgHigh - avgLow
    if (diff <= -8) {
      lagInsight = `Nach harten Tagen (TSS ≥80) liegt deine Recovery im Schnitt ${Math.abs(diff)} Punkte niedriger.`
    } else if (diff >= 8) {
      lagInsight = 'Recovery reagiert wenig auf hohe TSS — evtl. gut adaptiert oder TSS zu niedrig geschätzt.'
    }
  }

  return {
    avgRecoveryAfterHighTss: avgHigh,
    avgRecoveryAfterLowTss: avgLow,
    lagInsight,
  }
}

export function berechneWhoopStravaInsight(
  activities: StravaActivityRow[],
  ftp: number | null,
): WhoopStravaInsight {
  const store = ladeDailyStore()
  const heuteIso = isoTag(new Date())
  const heute = store.days.find((d) => d.date === heuteIso) ?? store.days[store.days.length - 1]
  const recovery = heute?.recoveryPercent ?? null
  const trend14d = berechneTrend14d(activities, ftp)
  const lag14d = berechneLag14d(activities, ftp)
  const { avgRecoveryAfterHighTss, avgRecoveryAfterLowTss, lagInsight } = lagStatistik(lag14d)

  const withRecovery = trend14d.filter((p) => p.recovery != null)
  const avgRecovery14d =
    withRecovery.length > 0
      ? Math.round(withRecovery.reduce((s, p) => s + (p.recovery ?? 0), 0) / withRecovery.length)
      : null
  const avgTss14d =
    trend14d.length > 0
      ? Math.round(trend14d.reduce((s, p) => s + p.tss, 0) / trend14d.length)
      : null

  const ws = startOfWeek(new Date())
  const weekTss = activities
    .filter((a) => istRadAktivitaet(a) && Date.parse(a.start_date) >= ws.getTime())
    .reduce((s, a) => s + geschaetztesTss(a, ftp), 0)

  const yesterdayTss = Math.round(tssAmTag(activities, tagOffset(heuteIso, -1), ftp))

  if (recovery == null) {
    return {
      hasWhoop: store.days.some((d) => d.recoveryPercent != null),
      recovery: null,
      recoveryLabel: null,
      weekTss: Math.round(weekTss),
      recommendation: 'WHOOP-Daten unter Fitnessdaten verbinden für Recovery-Empfehlungen.',
      color: '#71717a',
      trend14d,
      lag14d,
      avgRecovery14d,
      avgTss14d,
      avgRecoveryAfterHighTss,
      avgRecoveryAfterLowTss,
      lagInsight,
    }
  }

  let recommendation: string
  let color: string
  let recoveryLabel: string

  if (recovery >= 67) {
    recoveryLabel = 'Grün — optimal'
    if (weekTss < 200) {
      recommendation = 'Recovery stark — gute Tag für Intervalle oder lange harte Einheit.'
      color = '#4ade80'
    } else {
      recommendation = 'Recovery gut, aber Wochenbelastung schon hoch — moderate Intensität.'
      color = '#22d3ee'
    }
  } else if (recovery >= 34) {
    recoveryLabel = 'Gelb — ausreichend'
    recommendation = 'Sweet-Spot oder tempo-Arbeit möglich — keine maximalen Intervalle.'
    color = '#eab308'
  } else {
    recoveryLabel = 'Rot — niedrig'
    recommendation = 'Recovery niedrig — heute Zone-2 oder Ruhetag empfohlen.'
    color = '#f87171'
  }

  if (yesterdayTss >= 100 && recovery < 50) {
    recommendation += ` Gestern ${yesterdayTss} TSS — niedrige Recovery passt zur Belastung.`
  }

  if (avgRecovery14d != null && avgTss14d != null && avgRecovery14d < 50 && avgTss14d > 80) {
    recommendation += ' 14-Tage-Muster: hohe Belastung bei niedriger Recovery — Deload erwägen.'
  }

  if (lagInsight) {
    recommendation += ` ${lagInsight}`
  }

  return {
    hasWhoop: true,
    recovery,
    recoveryLabel,
    weekTss: Math.round(weekTss),
    recommendation,
    color,
    trend14d,
    lag14d,
    avgRecovery14d,
    avgTss14d,
    avgRecoveryAfterHighTss,
    avgRecoveryAfterLowTss,
    lagInsight,
  }
}
