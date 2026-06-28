'use client'

import { ComposedChart, Line, Area, XAxis, YAxis, Legend } from 'recharts'
import { formatKm } from '@/components/strava/strava-chart-utils'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import {
  StravaBrush,
  StravaCartesianGrid,
  StravaChartShell,
  StravaTooltip,
  STRAVA_CHART_AXIS,
} from '@/components/strava/strava-recharts'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { formLabel, type FormPoint } from '@/lib/strava/strava-training-load'
import { useMemo } from 'react'

export function StravaFormChart({ data, current }: { data: FormPoint[]; current: FormPoint | null }) {
  const slice = useMemo(() => data.slice(-56), [data])
  const chartData = useMemo(
    () =>
      slice.map((p) => ({
        label: p.label,
        CTL: p.ctl,
        ATL: p.atl,
        TSB: p.tsb,
        TSS: p.tss,
      })),
    [slice],
  )

  const status = current ? formLabel(current.tsb) : null

  return (
    <StravaCard padding="md" accent="cyan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <StravaSectionTitle title="Fitness · Fatigue · Form" subtitle="CTL / ATL / TSB · Zoom unten" />
        {current && status ? (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Form (TSB)</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: status.color }}>
              {current.tsb > 0 ? '+' : ''}
              {current.tsb}
            </p>
            <p className="text-[10px]" style={{ color: status.color }}>
              {status.label}
            </p>
          </div>
        ) : null}
      </div>

      <StravaChartShell height={200} minWidth={420}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <StravaCartesianGrid />
          <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...STRAVA_CHART_AXIS} width={36} />
          <StravaTooltip />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
          <Area type="monotone" dataKey="CTL" stroke={STRAVA_COLORS.cyan} fill="rgba(34,211,238,0.08)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ATL" stroke={STRAVA_COLORS.orange} strokeWidth={2} dot={false} />
          <StravaBrush />
        </ComposedChart>
      </StravaChartShell>

      {current ? (
        <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
          Aktuell: CTL {current.ctl} · ATL {current.atl} · Wochen-TSS {current.tss}
        </p>
      ) : null}
    </StravaCard>
  )
}
