/** Strava — Saisonziele & Fortschritt. */

import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow, StravaSeasonGoals } from '@/lib/strava/strava-types'

export type GoalProgress = {
  key: string
  label: string
  current: number
  target: number
  unit: string
  pct: number
  onTrack: boolean
  detail?: string
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}

export function berechneZielFortschritt(
  activities: StravaActivityRow[],
  goals: StravaSeasonGoals,
  now = new Date(),
): GoalProgress[] {
  const rides = activities.filter(istRadAktivitaet)
  const year = now.getFullYear()
  const yearRides = rides.filter((a) => new Date(a.start_date).getFullYear() === year)
  const out: GoalProgress[] = []

  if (goals.goal_km_year != null && goals.goal_km_year > 0) {
    const km = yearRides.reduce((s, a) => s + a.distance_m, 0) / 1000
    const dayOfYear = Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1
    const expected = (goals.goal_km_year * dayOfYear) / (365 + (year % 4 === 0 ? 1 : 0))
    out.push({
      key: 'km',
      label: 'Jahres-Kilometer',
      current: Math.round(km),
      target: Math.round(goals.goal_km_year),
      unit: 'km',
      pct: Math.min(100, (km / goals.goal_km_year) * 100),
      onTrack: km >= expected * 0.9,
      detail: `${Math.round(km).toLocaleString('de-DE')} / ${Math.round(goals.goal_km_year).toLocaleString('de-DE')} km`,
    })
  }

  if (goals.goal_hm_year != null && goals.goal_hm_year > 0) {
    const hm = yearRides.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)
    out.push({
      key: 'hm',
      label: 'Jahres-Höhenmeter',
      current: Math.round(hm),
      target: Math.round(goals.goal_hm_year),
      unit: 'm',
      pct: Math.min(100, (hm / goals.goal_hm_year) * 100),
      onTrack: true,
      detail: `${Math.round(hm).toLocaleString('de-DE')} / ${Math.round(goals.goal_hm_year).toLocaleString('de-DE')} m`,
    })
  }

  if (goals.goal_rides_per_week != null && goals.goal_rides_per_week > 0) {
    const ws = startOfWeek(now)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    we.setHours(23, 59, 59, 999)
    const weekCount = yearRides.filter((a) => {
      const t = Date.parse(a.start_date)
      return t >= ws.getTime() && t <= we.getTime()
    }).length
    out.push({
      key: 'freq',
      label: 'Fahrten diese Woche',
      current: weekCount,
      target: goals.goal_rides_per_week,
      unit: '',
      pct: Math.min(100, (weekCount / goals.goal_rides_per_week) * 100),
      onTrack: weekCount >= goals.goal_rides_per_week,
      detail: `${weekCount} / ${goals.goal_rides_per_week} Fahrten`,
    })
  }

  if (goals.goal_event_date && goals.goal_event_name) {
    const eventMs = Date.parse(goals.goal_event_date)
    const daysLeft = Math.ceil((eventMs - now.getTime()) / 86_400_000)
    out.push({
      key: 'event',
      label: goals.goal_event_name,
      current: Math.max(0, daysLeft),
      target: 0,
      unit: 'Tage',
      pct: daysLeft > 0 ? 100 : 0,
      onTrack: daysLeft > 7,
      detail: daysLeft > 0 ? `Noch ${daysLeft} Tage` : daysLeft === 0 ? 'Heute!' : 'Vorbei',
    })
  }

  return out
}

export function parseSeasonGoals(raw: Partial<StravaSeasonGoals> | null | undefined): StravaSeasonGoals {
  return {
    goal_km_year: raw?.goal_km_year != null ? Number(raw.goal_km_year) : null,
    goal_hm_year: raw?.goal_hm_year != null ? Number(raw.goal_hm_year) : null,
    goal_rides_per_week: raw?.goal_rides_per_week != null ? Number(raw.goal_rides_per_week) : null,
    goal_tss_week: raw?.goal_tss_week != null ? Number(raw.goal_tss_week) : null,
    goal_event_name: raw?.goal_event_name?.trim() || null,
    goal_event_date: raw?.goal_event_date || null,
  }
}
