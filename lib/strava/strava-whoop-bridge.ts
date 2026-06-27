/** Strava × WHOOP — Recovery vs. geplante Belastung (Client-only). */

import { ladeDailyStore } from '@/lib/fitnessdaten/daily-records'
import { geschaetztesTss } from '@/lib/strava/strava-training-load'
import { istRadAktivitaet } from '@/lib/strava/strava-auswertung'
import type { StravaActivityRow } from '@/lib/strava/strava-types'

export type WhoopStravaInsight = {
  hasWhoop: boolean
  recovery: number | null
  recoveryLabel: string | null
  weekTss: number
  recommendation: string
  color: string
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return x
}

export function berechneWhoopStravaInsight(
  activities: StravaActivityRow[],
  ftp: number | null,
): WhoopStravaInsight {
  const store = ladeDailyStore()
  const heute = store.days.find((d) => d.date === new Date().toISOString().slice(0, 10))
    ?? store.days[store.days.length - 1]
  const recovery = heute?.recoveryPercent ?? null

  const ws = startOfWeek(new Date())
  const weekTss = activities
    .filter((a) => istRadAktivitaet(a) && Date.parse(a.start_date) >= ws.getTime())
    .reduce((s, a) => s + geschaetztesTss(a, ftp), 0)

  if (recovery == null) {
    return {
      hasWhoop: store.days.some((d) => d.recoveryPercent != null),
      recovery: null,
      recoveryLabel: null,
      weekTss: Math.round(weekTss),
      recommendation: 'WHOOP-Daten unter Fitnessdaten verbinden für Recovery-Empfehlungen.',
      color: '#71717a',
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

  return {
    hasWhoop: true,
    recovery,
    recoveryLabel,
    weekTss: Math.round(weekTss),
    recommendation,
    color,
  }
}
