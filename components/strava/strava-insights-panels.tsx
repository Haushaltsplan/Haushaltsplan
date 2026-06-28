'use client'

import { formatHm } from '@/components/strava/strava-chart-utils'
import { ComposedChart, Bar, XAxis, YAxis } from 'recharts'
import {
  StravaBrush,
  StravaCartesianGrid,
  StravaChartShell,
  StravaTooltip,
  STRAVA_CHART_AXIS,
} from '@/components/strava/strava-recharts'
import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type {
  ClimbingWeek,
  ConsistencyStats,
  IntensityMix,
  YearCompare,
} from '@/lib/strava/strava-insights'
import { useMemo } from 'react'

export function StravaConsistencyPanel({ stats }: { stats: ConsistencyStats }) {
  return (
    <StravaCard padding="md" hover>
      <StravaSectionTitle title="Konsistenz" subtitle="Trainingsdisziplin" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Aktuelle Streak</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--app-text)]">{stats.currentStreakWeeks}</p>
          <p className="text-[10px] text-[var(--app-text-muted)]">Wochen</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Rekord-Streak</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--app-text)]">{stats.longestStreakWeeks}</p>
          <p className="text-[10px] text-[var(--app-text-muted)]">Wochen</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-[var(--app-text-muted)]">
          <span>{stats.weeksWithRide} / {stats.totalWeeks} Wochen aktiv</span>
          <span>{Math.round(stats.consistencyPct)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.consistencyPct}%`, background: STRAVA_COLORS.green }}
          />
        </div>
      </div>
    </StravaCard>
  )
}

export function StravaIntensityPanel({ mix }: { mix: IntensityMix }) {
  const segments = [
    { label: 'Easy (Z1-2)', pct: mix.easyPct, color: '#22c55e' },
    { label: 'Moderate (Z3)', pct: mix.moderatePct, color: '#eab308' },
    { label: 'Hard (Z4-5)', pct: mix.hardPct, color: '#f97316' },
  ]
  return (
    <StravaCard padding="md" hover>
      <StravaSectionTitle title="Intensitäts-Mix" subtitle="Polarisation · 28 Tage" />
      <div className="flex h-3 overflow-hidden rounded-full">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label}: ${s.pct.toFixed(0)}%`} />
          ) : null,
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-[var(--app-text-muted)]">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums text-[var(--app-text)]">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}

export function StravaClimbingPanel({ data }: { data: ClimbingWeek[] }) {
  const chartData = useMemo(
    () => data.map((d) => ({ label: d.label, hm: d.hm })),
    [data],
  )

  if (chartData.every((d) => d.hm === 0)) return null

  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Kletter-Profil" subtitle="Höhenmeter pro Woche · Zoom unten" />
      <StravaChartShell height={180} minWidth={360}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <StravaCartesianGrid />
          <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" minTickGap={20} />
          <YAxis {...STRAVA_CHART_AXIS} width={36} unit=" m" />
          <StravaTooltip formatter={(v) => formatHm(Number(v ?? 0))} />
          <Bar dataKey="hm" name="Hm" fill={STRAVA_COLORS.green} radius={[2, 2, 0, 0]} />
          <StravaBrush />
        </ComposedChart>
      </StravaChartShell>
    </StravaCard>
  )
}

export function StravaYearComparePanel({ items }: { items: YearCompare[] }) {
  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Jahresvergleich" subtitle="YTD vs. Vorjahr" />
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${STRAVA_INTERACTIVE} hover:bg-white/[0.03]`}>
            <span className="text-xs text-[var(--app-text-muted)]">{item.label}</span>
            <div className="text-right">
              <span className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{item.current}</span>
              {item.changePct != null ? (
                <span
                  className="ml-2 text-[10px] font-medium tabular-nums"
                  style={{ color: item.changePct >= 0 ? STRAVA_COLORS.positive : STRAVA_COLORS.negative }}
                >
                  {item.changePct >= 0 ? '+' : ''}
                  {item.changePct.toFixed(0)}%
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}
