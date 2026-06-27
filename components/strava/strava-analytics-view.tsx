'use client'

import { StravaActivityFeed } from '@/components/strava/strava-activity-feed'
import { StravaVolumeChart, StravaSpeedTrendChart, StravaZoneDonut } from '@/components/strava/strava-charts'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaKpiBar } from '@/components/strava/strava-kpi-bar'
import {
  berechneStravaDashboardAnalytics,
  type KpiPeriod,
} from '@/lib/strava/strava-dashboard-analytics'
import type { StravaActivityRow } from '@/lib/strava/strava-types'
import { useMemo, useState } from 'react'

type Props = {
  activities: StravaActivityRow[]
  maxHr?: number | null
}

export function StravaAnalyticsView({ activities, maxHr }: Props) {
  const [period, setPeriod] = useState<KpiPeriod>('week')

  const analytics = useMemo(
    () => berechneStravaDashboardAnalytics(activities, { period, maxHr }),
    [activities, period, maxHr],
  )

  return (
    <div className="space-y-6">
      <StravaKpiBar kpis={analytics.kpis} period={period} onPeriodChange={setPeriod} />

      <div className="grid gap-4 xl:grid-cols-2">
        <StravaVolumeChart data={analytics.weeklyVolume} />
        <StravaZoneDonut slices={analytics.zoneDistribution} mode={analytics.zoneMode} />
      </div>

      <StravaSpeedTrendChart points={analytics.speedTrend} />

      <StravaActivityFeed activities={analytics.activities} />

      <p className="text-center text-[10px] text-zinc-600">
        Powered by{' '}
        <span style={{ color: STRAVA_COLORS.orange }} className="font-semibold">
          Strava
        </span>{' '}
        · Athletic Analytics
      </p>
    </div>
  )
}
