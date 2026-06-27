/** Strava — Extended Analytics (alles kombiniert). */

import { berechneStravaDashboardAnalytics, type StravaDashboardAnalytics } from '@/lib/strava/strava-dashboard-analytics'
import { berechneZielFortschritt } from '@/lib/strava/strava-goals'
import {
  aggregierteHrZonen,
  berechneJahresvergleich,
  berechneKletterProfil,
  berechneKonsistenz,
  berechneIntensitaetsMix,
  berechneSmartAlerts,
  type ClimbingWeek,
  type ConsistencyStats,
  type IntensityMix,
  type SmartAlert,
  type YearCompare,
} from '@/lib/strava/strava-insights'
import { berechnePowerCurve, schaetzeEftp, type PowerCurvePoint } from '@/lib/strava/strava-power-curve'
import { aktuelleForm, berechneFormVerlauf, type FormPoint } from '@/lib/strava/strava-training-load'
import type { GoalProgress } from '@/lib/strava/strava-goals'
import type { KpiPeriod } from '@/lib/strava/strava-dashboard-analytics'
import type { StravaActivityRow, StravaAthleteProfile, StravaSeasonGoals } from '@/lib/strava/strava-types'

export type StravaExtendedAnalytics = StravaDashboardAnalytics & {
  powerCurve: PowerCurvePoint[]
  eftp: number | null
  stravaFtp: number | null
  formVerlauf: FormPoint[]
  currentForm: FormPoint | null
  consistency: ConsistencyStats
  intensityMix: IntensityMix
  climbing: ClimbingWeek[]
  yearCompare: YearCompare[]
  goals: GoalProgress[]
  alerts: SmartAlert[]
  streamBacklog: number
}

export function berechneStravaExtendedAnalytics(
  activities: StravaActivityRow[],
  athlete: StravaAthleteProfile | null,
  opts: { period?: KpiPeriod } = {},
): StravaExtendedAnalytics {
  const period = opts.period ?? 'week'
  const maxHr = athlete?.max_hr ?? null
  const ftp = athlete?.ftp ?? null
  const weightKg = athlete?.omnia_weight_kg ?? null

  const base = berechneStravaDashboardAnalytics(activities, { period, maxHr })
  const powerCurve = berechnePowerCurve(activities, weightKg)
  const eftp = schaetzeEftp(powerCurve)
  const formVerlauf = berechneFormVerlauf(activities, ftp ?? eftp, 84)
  const currentForm = aktuelleForm(activities, ftp ?? eftp)
  const consistency = berechneKonsistenz(activities)
  const intensityMix = berechneIntensitaetsMix(activities, maxHr, ftp ?? eftp)
  const climbing = berechneKletterProfil(activities)
  const yearCompare = berechneJahresvergleich(activities)

  const goals: StravaSeasonGoals = {
    goal_km_year: athlete?.goal_km_year ?? null,
    goal_hm_year: athlete?.goal_hm_year ?? null,
    goal_rides_per_week: athlete?.goal_rides_per_week ?? null,
    goal_event_name: athlete?.goal_event_name ?? null,
    goal_event_date: athlete?.goal_event_date ?? null,
  }
  const goalProgress = berechneZielFortschritt(activities, goals)

  const alerts = berechneSmartAlerts(activities, {
    ftp: ftp ?? eftp,
    tsb: currentForm?.tsb ?? null,
    consistency,
    mix: intensityMix,
  })

  const streamBacklog = activities.filter(
    (a) => (a.device_watts || a.average_watts) && !a.power_peaks,
  ).length

  // Wenn echte HR-Stream-Zonen vorhanden, Zone-Distribution verbessern
  if (maxHr != null && maxHr > 0) {
    const agg = aggregierteHrZonen(activities, maxHr)
    const total = agg.z1 + agg.z2 + agg.z3 + agg.z4 + agg.z5
    if (total > 0) {
      const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444']
      const labels = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5']
      const keys = ['z1', 'z2', 'z3', 'z4', 'z5'] as const
      base.zoneDistribution = keys.map((k, i) => ({
        key: k,
        label: labels[i],
        color: colors[i],
        minutes: agg[k],
        pct: (agg[k] / total) * 100,
      }))
      base.zoneMode = 'hr'
    }
  }

  return {
    ...base,
    powerCurve,
    eftp,
    stravaFtp: ftp,
    formVerlauf,
    currentForm,
    consistency,
    intensityMix,
    climbing,
    yearCompare,
    goals: goalProgress,
    alerts,
    streamBacklog,
  }
}
