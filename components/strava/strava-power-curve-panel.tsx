'use client'

import { ComposedChart, Line, XAxis, YAxis, Area, ReferenceLine } from 'recharts'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import {
  StravaBrush,
  StravaCartesianGrid,
  StravaChartShell,
  StravaTooltip,
  STRAVA_CHART_AXIS,
} from '@/components/strava/strava-recharts'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { STRAVA_PANEL_INFO } from '@/lib/strava/strava-panel-info'
import type { PowerCurvePoint } from '@/lib/strava/strava-power-curve'
import { useMemo } from 'react'

export function StravaPowerCurvePanel({
  curve,
  curve90d,
  eftp,
  stravaFtp,
}: {
  curve: PowerCurvePoint[]
  curve90d?: PowerCurvePoint[]
  eftp: number | null
  stravaFtp: number | null
}) {
  const withData = curve.filter((p) => p.bestWatts != null)
  const withData90 = (curve90d ?? []).filter((p) => p.bestWatts != null)

  const chartData = useMemo(() => {
    return withData.map((p) => {
      const p90 = withData90.find((x) => x.key === p.key)
      return {
        label: p.label.replace('Peak ', '').replace('Ø ', ''),
        seconds: p.seconds,
        allTime: p.bestWatts,
        days90: p90?.bestWatts ?? null,
        activityName: p.activityName,
        activityId: p.activityId,
        wkg: p.bestWkg,
      }
    })
  }, [withData, withData90])

  if (withData.length === 0) {
    return (
      <StravaCard padding="md" accent="orange">
        <StravaSectionTitle title="Power Curve" subtitle="Sync mehrfach ausführen für Watt-Streams" info={STRAVA_PANEL_INFO.powerCurveEmpty} />
        <p className="text-sm text-[var(--app-text-muted)]">
          Noch keine Power-Peak-Daten — benötigt Powermeter + Stream-Sync.
        </p>
      </StravaCard>
    )
  }

  return (
    <StravaCard padding="md" accent="orange">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StravaSectionTitle className="mb-0 min-w-0 flex-1" title="Power Curve" subtitle="Log-Dauerachse · All-time vs. 90 Tage" info={STRAVA_PANEL_INFO.powerCurve} />
        <div className="flex gap-4 text-right">
          {eftp ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">eFTP (geschätzt)</p>
              <p className="text-xl font-bold tabular-nums text-orange-300">{eftp} W</p>
            </div>
          ) : null}
          {stravaFtp ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Strava FTP</p>
              <p className="text-xl font-bold tabular-nums text-[var(--app-text)]">{stravaFtp} W</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-2 flex gap-4 text-[10px] text-[var(--app-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: STRAVA_COLORS.orange }} />
          All-time
        </span>
        {withData90.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded border border-cyan-400 border-dashed" />
            90 Tage
          </span>
        ) : null}
      </div>

      <StravaChartShell height={220} brush={false}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <StravaCartesianGrid />
          <XAxis
            dataKey="seconds"
            scale="log"
            domain={['auto', 'auto']}
            {...STRAVA_CHART_AXIS}
            tickFormatter={(v) => {
              const n = Number(v)
              if (n >= 3600) return `${n / 3600}h`
              if (n >= 60) return `${n / 60}m`
              return `${n}s`
            }}
          />
          <YAxis {...STRAVA_CHART_AXIS} width={40} unit=" W" />
          <StravaTooltip
            formatter={(v, name) => {
              const n = Number(v)
              if (!Number.isFinite(n)) return '—'
              return `${Math.round(n)} W`
            }}
          />
          {withData90.length > 0 ? (
            <Line
              type="monotone"
              dataKey="days90"
              name="90 Tage"
              stroke={STRAVA_COLORS.cyan}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={{ r: 3 }}
              connectNulls
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="allTime"
            name="All-time"
            stroke={STRAVA_COLORS.orange}
            fill="rgba(252,76,2,0.12)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: STRAVA_COLORS.orange }}
          />
        </ComposedChart>
      </StravaChartShell>
    </StravaCard>
  )
}
