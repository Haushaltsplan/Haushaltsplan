'use client'

import { ComposedChart, Line, XAxis, YAxis, Scatter } from 'recharts'
import {
  StravaCartesianGrid,
  StravaChartShell,
  StravaTooltip,
  STRAVA_CHART_AXIS,
} from '@/components/strava/strava-recharts'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type { WhoopStravaInsight } from '@/lib/strava/strava-whoop-bridge'
import Link from 'next/link'
import { useMemo } from 'react'

export function StravaWhoopPanel({ insight }: { insight: WhoopStravaInsight }) {
  const trendData = useMemo(
    () =>
      insight.trend14d.map((p) => ({
        label: p.label,
        Recovery: p.recovery,
        TSS: p.tss,
      })),
    [insight.trend14d],
  )

  const lagData = useMemo(
    () =>
      insight.lag14d.map((p) => ({
        label: p.label,
        Recovery: p.recovery,
        TSS_Vortag: p.tssPrev,
      })),
    [insight.lag14d],
  )

  return (
    <StravaCard padding="md" accent="cyan">
      <StravaSectionTitle title="WHOOP × Strava" subtitle="Recovery vs. Belastung" />
      <div className="flex flex-wrap items-center gap-4">
        {insight.recovery != null ? (
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ borderColor: insight.color }}>
            <span className="text-lg font-bold tabular-nums" style={{ color: insight.color }}>
              {insight.recovery}%
            </span>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[var(--app-border-strong)] text-[var(--app-text-muted)]">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          {insight.recoveryLabel ? (
            <p className="text-sm font-semibold" style={{ color: insight.color }}>
              {insight.recoveryLabel}
            </p>
          ) : null}
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">{insight.recommendation}</p>
          <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
            Wochen-TSS (Rad): {insight.weekTss}
            {insight.avgRecovery14d != null ? ` · Ø Recovery 14d: ${insight.avgRecovery14d}%` : ''}
            {insight.avgRecoveryAfterHighTss != null
              ? ` · Recovery nach hartem Tag: ${insight.avgRecoveryAfterHighTss}%`
              : ''}
          </p>
        </div>
      </div>

      {insight.hasWhoop && trendData.some((p) => p.Recovery != null || (p.TSS ?? 0) > 0) ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
            14 Tage — Recovery vs. TSS (Touch/Zoom)
          </p>
          <StravaChartShell height={160} brush={false}>
            <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <StravaCartesianGrid />
              <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" minTickGap={16} />
              <YAxis yAxisId="left" {...STRAVA_CHART_AXIS} width={32} domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" {...STRAVA_CHART_AXIS} width={32} />
              <StravaTooltip />
              <Line yAxisId="left" type="monotone" dataKey="Recovery" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="TSS" stroke="#fb923c" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </StravaChartShell>
        </div>
      ) : null}

      {lagData.length >= 2 ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
            Recovery vs. TSS Vortag
          </p>
          <StravaChartShell height={160} brush={false}>
            <ComposedChart data={lagData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <StravaCartesianGrid />
              <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" />
              <YAxis yAxisId="rec" {...STRAVA_CHART_AXIS} width={32} domain={[0, 100]} name="Recovery" />
              <YAxis yAxisId="tss" orientation="right" {...STRAVA_CHART_AXIS} width={32} name="TSS Vortag" />
              <StravaTooltip />
              <Scatter yAxisId="rec" dataKey="Recovery" fill="#22d3ee" name="Recovery" />
              <Line yAxisId="tss" type="monotone" dataKey="TSS_Vortag" stroke="#fb923c" strokeWidth={1.5} dot={{ r: 3 }} name="TSS Vortag" />
            </ComposedChart>
          </StravaChartShell>
          <p className="mt-1 text-[10px] text-[var(--app-text-muted)]">
            {insight.avgRecoveryAfterLowTss != null
              ? `Ø Recovery nach leichtem Tag: ${insight.avgRecoveryAfterLowTss}%`
              : ''}
          </p>
        </div>
      ) : null}

      {!insight.hasWhoop ? (
        <Link href="/fitnessdaten" className="mt-3 inline-block text-xs text-cyan-400 underline hover:text-cyan-300">
          WHOOP unter Fitnessdaten verbinden →
        </Link>
      ) : null}
    </StravaCard>
  )
}
