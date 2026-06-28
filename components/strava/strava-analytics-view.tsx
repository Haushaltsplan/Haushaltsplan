'use client'

import { StravaActivityFeed } from '@/components/strava/strava-activity-feed'
import { StravaActivityModal } from '@/components/strava/strava-activity-modal'
import {
  StravaActivityFilterBar,
  useFilteredActivities,
  useSortedFeed,
  type FilterBarState,
} from '@/components/strava/strava-activity-filter-bar'
import { StravaBackfillPanel } from '@/components/strava/strava-backfill-panel'
import { StravaAdvancedSection } from '@/components/strava/strava-advanced-panels'
import { StravaStreckenPrPanel } from '@/components/strava/strava-strecken-pr-panel'
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
import {
  StravaMonthlyProgressChart,
  StravaPrTimelinePanel,
  StravaQuarterlyPowerPanel,
  StravaTssAdherencePanel,
  StravaTssBudgetPanel,
} from '@/components/strava/strava-progress-panels'
import { StravaWeatherPanel } from '@/components/strava/strava-weather-panel'
import { StravaWhoopPanel } from '@/components/strava/strava-whoop-panel'
import type { BackfillStatus } from '@/lib/strava/strava-backfill-status'
import type { KpiPeriod } from '@/lib/strava/strava-dashboard-analytics'
import {
  berechneStravaExtendedAnalytics,
  type StravaExtendedAnalytics,
} from '@/lib/strava/strava-extended-analytics'
import type { StravaSegmentEffortRow } from '@/lib/strava/strava-segments'
import { berechneWhoopStravaInsight } from '@/lib/strava/strava-whoop-bridge'
import type { StravaActivityRow, StravaAthleteProfile } from '@/lib/strava/strava-types'
import { useMemo, useState } from 'react'

type Props = {
  activities: StravaActivityRow[]
  athlete: StravaAthleteProfile | null
  segmentEfforts?: StravaSegmentEffortRow[]
  segmentBacklog?: number
  backfill?: BackfillStatus | null
  backfillBusy?: boolean
  backfillRound?: number | null
  onBackfill?: () => void
  onGoalsSaved?: () => void
}

export function StravaAnalyticsView({
  activities,
  athlete,
  segmentEfforts = [],
  segmentBacklog = 0,
  backfill = null,
  backfillBusy = false,
  backfillRound = null,
  onBackfill,
  onGoalsSaved,
}: Props) {
  const [period, setPeriod] = useState<KpiPeriod>('week')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterState, setFilterState] = useState<FilterBarState>({
    rangeDays: 84,
    ridesOnly: true,
    outdoorOnly: false,
    sortKey: 'date',
    sortDesc: true,
  })

  const weightKg = athlete?.omnia_weight_kg ?? null
  const filteredActivities = useFilteredActivities(activities, filterState)
  const feedActivities = useSortedFeed(
    filteredActivities,
    filterState.sortKey,
    filterState.sortDesc,
    weightKg,
  )

  const analytics: StravaExtendedAnalytics = useMemo(
    () =>
      berechneStravaExtendedAnalytics(filteredActivities, athlete, {
        period,
        segmentEfforts,
        segmentBacklog,
      }),
    [filteredActivities, athlete, period, segmentEfforts, segmentBacklog],
  )

  const weatherBacklog = useMemo(
    () =>
      backfill?.categories.find((c) => c.key === 'weather')?.pending ??
      activities.filter((a) => a.weather_temp_c == null).length,
    [backfill, activities],
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

      {backfill ? (
        <StravaBackfillPanel
          backfill={backfill}
          busy={backfillBusy}
          backfillRound={backfillRound}
          onBackfill={onBackfill}
        />
      ) : null}

      <StravaActivityFilterBar
        state={filterState}
        onChange={setFilterState}
        activities={filteredActivities}
        filteredCount={filteredActivities.length}
        athlete={athlete}
        analytics={analytics}
      />

      <StravaKpiBar kpis={analytics.kpis} period={period} onPeriodChange={setPeriod} />

      <StravaGoalsPanel
        goals={analytics.goals}
        athlete={athlete}
        onSaved={() => onGoalsSaved?.()}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StravaMonthlyProgressChart data={analytics.progress.monthly} />
        <StravaTssBudgetPanel budget={analytics.progress.tssBudget} />
      </div>

      <StravaTssAdherencePanel
        adherence={analytics.progress.tssAdherence}
        weeklyTarget={analytics.progress.tssBudget.weeklyTarget}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StravaWeatherPanel analysis={analytics.weatherAnalysis} backlog={weatherBacklog} />
        <StravaPrTimelinePanel items={analytics.progress.prTimeline} />
      </div>

      <StravaQuarterlyPowerPanel quarters={analytics.progress.quarterlyCurves} />

      <StravaAdvancedSection advanced={analytics.advanced} />

      <StravaStreckenPrPanel segments={analytics.segments} routes={analytics.routes} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StravaFormChart data={analytics.formVerlauf} current={analytics.currentForm} />
        <StravaPowerCurvePanel
          curve={analytics.powerCurve}
          curve90d={analytics.powerCurve90d}
          eftp={analytics.eftp}
          stravaFtp={analytics.stravaFtp}
        />
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
        activities={feedActivities}
        onSelect={(id) => setSelectedId(id)}
      />

      <StravaActivityModal
        activity={selectedActivity}
        athlete={athlete}
        onClose={() => setSelectedId(null)}
      />

      <p className="text-center text-[10px] text-[var(--app-text-muted)]">
        Powered by{' '}
        <span style={{ color: STRAVA_COLORS.orange }} className="font-semibold">
          Strava
        </span>{' '}
        · Athletic Analytics Pro
      </p>
    </div>
  )
}
