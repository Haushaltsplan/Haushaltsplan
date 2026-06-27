'use client'

import { StravaActivityFeed } from '@/components/strava/strava-activity-feed'
import { StravaActivityModal } from '@/components/strava/strava-activity-modal'
import { StravaAlertsBanner } from '@/components/strava/strava-alerts-banner'
import { StravaVolumeChart, StravaSpeedTrendChart, StravaZoneDonut } from '@/components/strava/strava-charts'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaFormChart } from '@/components/strava/strava-form-chart'
import { StravaGoalsPanel } from '@/components/strava/strava-goals-panel'
import {
  StravaClimbingPanel,
  StravaConsistencyPanel,
  StravaIntensityPanel,
  StravaYearComparePanel,
} from '@/components/strava/strava-insights-panels'
import { StravaKpiBar } from '@/components/strava/strava-kpi-bar'
import { StravaPowerCurvePanel } from '@/components/strava/strava-power-curve-panel'
import { StravaWhoopPanel } from '@/components/strava/strava-whoop-panel'
import {
  berechneStravaExtendedAnalytics,
  type StravaExtendedAnalytics,
} from '@/lib/strava/strava-extended-analytics'
import type { KpiPeriod } from '@/lib/strava/strava-dashboard-analytics'
import { berechneWhoopStravaInsight } from '@/lib/strava/strava-whoop-bridge'
import type { StravaActivityRow, StravaAthleteProfile } from '@/lib/strava/strava-types'
import { useMemo, useState } from 'react'

type Props = {
  activities: StravaActivityRow[]
  athlete: StravaAthleteProfile | null
  onGoalsSaved?: () => void
}

export function StravaAnalyticsView({ activities, athlete, onGoalsSaved }: Props) {
  const [period, setPeriod] = useState<KpiPeriod>('week')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const analytics: StravaExtendedAnalytics = useMemo(
    () => berechneStravaExtendedAnalytics(activities, athlete, { period }),
    [activities, athlete, period],
  )

  const whoopInsight = useMemo(
    () => berechneWhoopStravaInsight(activities, athlete?.ftp ?? analytics.eftp),
    [activities, athlete?.ftp, analytics.eftp],
  )

  const selectedActivity = useMemo(
    () => (selectedId != null ? activities.find((a) => a.strava_id === selectedId) ?? null : null),
    [activities, selectedId],
  )

  return (
    <div className="space-y-6">
      <StravaAlertsBanner alerts={analytics.alerts} />

      {analytics.streamBacklog > 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2 text-[11px] text-zinc-500">
          {analytics.streamBacklog} Fahrten warten auf Stream-Analyse — Sync mehrfach klicken oder Vollimport nutzen.
        </p>
      ) : null}

      <StravaKpiBar kpis={analytics.kpis} period={period} onPeriodChange={setPeriod} />

      <StravaGoalsPanel
        goals={analytics.goals}
        athlete={athlete}
        onSaved={() => onGoalsSaved?.()}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StravaFormChart data={analytics.formVerlauf} current={analytics.currentForm} />
        <StravaPowerCurvePanel curve={analytics.powerCurve} eftp={analytics.eftp} stravaFtp={analytics.stravaFtp} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StravaConsistencyPanel stats={analytics.consistency} />
        <StravaIntensityPanel mix={analytics.intensityMix} />
        <StravaWhoopPanel insight={whoopInsight} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StravaVolumeChart data={analytics.weeklyVolume} />
        <StravaZoneDonut slices={analytics.zoneDistribution} mode={analytics.zoneMode} />
      </div>

      <StravaSpeedTrendChart points={analytics.speedTrend} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StravaClimbingPanel data={analytics.climbing} />
        <StravaYearComparePanel items={analytics.yearCompare} />
      </div>

      <StravaActivityFeed
        activities={analytics.activities}
        onSelect={(id) => setSelectedId(id)}
      />

      <StravaActivityModal
        activity={selectedActivity}
        athlete={athlete}
        onClose={() => setSelectedId(null)}
      />

      <p className="text-center text-[10px] text-zinc-600">
        Powered by{' '}
        <span style={{ color: STRAVA_COLORS.orange }} className="font-semibold">
          Strava
        </span>{' '}
        · Athletic Analytics Pro
      </p>
    </div>
  )
}
