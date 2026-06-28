'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, Legend } from 'recharts'
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
import { STRAVA_PANEL_INFO } from '@/lib/strava/strava-panel-info'
import type { SpeedTrendPoint, WeeklyVolumeBar, ZoneSlice } from '@/lib/strava/strava-dashboard-analytics'
import { SPORT_COLORS } from '@/lib/strava/strava-dashboard-analytics'
import { useMemo } from 'react'

type VolumeChartProps = {
  data: WeeklyVolumeBar[]
}

export function StravaVolumeChart({ data }: VolumeChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        Ride: Math.round(d.rideKm * 10) / 10,
        Run: Math.round(d.runKm * 10) / 10,
        Sonstige: Math.round(d.otherKm * 10) / 10,
        totalKm: d.totalKm,
      })),
    [data],
  )

  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Volume & Consistency" subtitle="Wöchentliche Distanz · Zoom unten" info={STRAVA_PANEL_INFO.volumeChart} />
      <StravaChartShell height={200} minWidth={480}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <StravaCartesianGrid />
          <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" />
          <YAxis {...STRAVA_CHART_AXIS} width={32} unit=" km" />
          <StravaTooltip formatter={(v) => formatKm(Number(v ?? 0))} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
          <Bar dataKey="Ride" stackId="v" fill={SPORT_COLORS.ride} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Run" stackId="v" fill={SPORT_COLORS.run} />
          <Bar dataKey="Sonstige" stackId="v" fill={SPORT_COLORS.other} radius={[2, 2, 0, 0]} />
          <StravaBrush />
        </ComposedChart>
      </StravaChartShell>
    </StravaCard>
  )
}

type ZoneChartProps = {
  slices: ZoneSlice[]
  mode: 'hr' | 'sport'
}

export function StravaZoneDonut({ slices, mode }: ZoneChartProps) {
  const total = slices.reduce((s, z) => s + z.minutes, 0)
  const cx = 80
  const cy = 80
  const r = 58
  const ir = 38
  let angle = -Math.PI / 2

  const arcs = slices
    .filter((s) => s.pct > 0)
    .map((s) => {
      const sweep = (s.pct / 100) * Math.PI * 2
      const x1 = cx + r * Math.cos(angle)
      const y1 = cy + r * Math.sin(angle)
      angle += sweep
      const x2 = cx + r * Math.cos(angle)
      const y2 = cy + r * Math.sin(angle)
      const ix1 = cx + ir * Math.cos(angle - sweep)
      const iy1 = cy + ir * Math.sin(angle - sweep)
      const ix2 = cx + ir * Math.cos(angle)
      const iy2 = cy + ir * Math.sin(angle)
      const large = sweep > Math.PI ? 1 : 0
      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`
      return { ...s, d }
    })

  return (
    <StravaCard padding="md">
      <StravaSectionTitle
        title="Intensity & Zone Distribution"
        subtitle={mode === 'hr' ? 'HF-Zonen (geschätzt aus Ø-Puls)' : 'Verteilung nach Sportart'}
        info={STRAVA_PANEL_INFO.zoneDonut}
      />
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
          {total <= 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={20} />
          ) : (
            arcs.map((a) => (
              <path key={a.key} d={a.d} fill={a.color} className="transition-opacity duration-200 hover:opacity-80" />
            ))
          )}
          <text x={cx} y={cy - 4} textAnchor="middle" fill="#f4f4f5" fontSize="14" fontWeight="700">
            {total > 0 ? `${Math.round(total / 60)}h` : '—'}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#71717a" fontSize="8">
            gesamt
          </text>
        </svg>
        <div className="flex-1 space-y-2">
          {slices.map((z) => (
            <div key={z.key} className="group flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: z.color }} />
              <span className="min-w-[72px] text-xs text-[var(--app-text-muted)]">{z.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${z.pct}%`, background: z.color }}
                />
              </div>
              <span className="w-10 text-right text-[10px] tabular-nums text-[var(--app-text-muted)]">{z.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </StravaCard>
  )
}

type SpeedChartProps = {
  points: SpeedTrendPoint[]
}

export function StravaSpeedTrendChart({ points }: SpeedChartProps) {
  const chartData = useMemo(
    () =>
      points.map((p) => ({
        label: p.label,
        value: p.value,
        name: p.name,
        detail: `${p.valueLabel} · ${p.distanceLabel} · ${p.timeLabel}`,
      })),
    [points],
  )

  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Fitness & Speed Trend" subtitle="Ø Tempo/Pace · Zoom unten" info={STRAVA_PANEL_INFO.speedTrend} />
      {points.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--app-text-muted)]">Noch nicht genug Daten für den Trend.</p>
      ) : (
        <StravaChartShell height={200} minWidth={400}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <StravaCartesianGrid />
            <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" minTickGap={20} />
            <YAxis {...STRAVA_CHART_AXIS} width={36} />
            <StravaTooltip />
            <Line
              type="monotone"
              dataKey="value"
              name="Tempo/Pace"
              stroke={STRAVA_COLORS.cyan}
              strokeWidth={2.5}
              dot={{ r: 3, fill: STRAVA_COLORS.cyan }}
              activeDot={{ r: 5 }}
            />
            <StravaBrush />
          </ComposedChart>
        </StravaChartShell>
      )}
    </StravaCard>
  )
}
