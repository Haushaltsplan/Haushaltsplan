'use client'

import { appTableScrollInlineClassName } from '@/components/page-shell'
import {
  formatWatts,
  formatWkg,
} from '@/components/strava/strava-chart-utils'
import { ComposedChart, Line, Bar, XAxis, YAxis, ReferenceLine, Cell } from 'recharts'
import {
  StravaBrush,
  StravaCartesianGrid,
  StravaChartShell,
  StravaTooltip,
  STRAVA_CHART_AXIS,
} from '@/components/strava/strava-recharts'
import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type { ProgressAnalytics } from '@/lib/strava/strava-progress-analytics'
import { useMemo, useState } from 'react'

export function StravaMonthlyProgressChart({ data }: { data: ProgressAnalytics['monthly'] }) {
  const withEftp = data.filter((d) => d.eftp != null)
  const chartData = useMemo(
    () =>
      withEftp.map((d) => ({
        label: d.label,
        eFTP: d.eftp,
        rides: d.rides,
        km: d.km,
        tss: d.tss,
        avgWkg: d.avgWkg,
      })),
    [withEftp],
  )

  if (withEftp.length < 2) {
    return (
      <StravaCard padding="md">
        <StravaSectionTitle title="eFTP-Entwicklung" subtitle="Monatlicher Trend" />
        <p className="text-sm text-[var(--app-text-muted)]">Mehr Powermeter-Daten + Sync nötig für den Verlauf.</p>
      </StravaCard>
    )
  }

  return (
    <StravaCard padding="md" accent="orange">
      <StravaSectionTitle title="eFTP-Entwicklung" subtitle="Geschätzte FTP pro Monat · Zoom unten" />
      <StravaChartShell height={200} minWidth={420}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <StravaCartesianGrid />
          <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" minTickGap={20} />
          <YAxis {...STRAVA_CHART_AXIS} width={40} unit=" W" />
          <StravaTooltip
            formatter={(v, name) => (name === 'eFTP' ? `${v} W` : String(v))}
          />
          <Line
            type="monotone"
            dataKey="eFTP"
            stroke={STRAVA_COLORS.orange}
            strokeWidth={2.5}
            dot={{ r: 4, fill: STRAVA_COLORS.orange }}
            activeDot={{ r: 6 }}
          />
          <StravaBrush />
        </ComposedChart>
      </StravaChartShell>
    </StravaCard>
  )
}

export function StravaPrTimelinePanel({ items }: { items: ProgressAnalytics['prTimeline'] }) {
  if (items.length === 0) {
    return (
      <StravaCard padding="md">
        <StravaSectionTitle title="PR-Timeline" subtitle="Wann Rekorde gesetzt wurden" />
        <p className="text-sm text-[var(--app-text-muted)]">Noch keine Power-Peak-Rekorde.</p>
      </StravaCard>
    )
  }

  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="PR-Timeline" subtitle="Persönliche Power-Rekorde · chronologisch" />
      <div className="space-y-2">
        {items.map((pr) => (
          <div
            key={pr.key}
            className={[
              'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors',
              STRAVA_INTERACTIVE,
              pr.isRecent
                ? 'border-orange-500/25 bg-orange-500/5'
                : 'border-white/[0.06] bg-black/20 hover:bg-white/[0.03]',
            ].join(' ')}
          >
            <div>
              <p className="font-semibold text-[var(--app-text)]">{pr.label}</p>
              <p className="text-[11px] text-[var(--app-text-muted)]">{pr.activityName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-orange-300">{formatWatts(pr.watts)}</p>
              {pr.wkg != null ? (
                <p className="text-[10px] text-[var(--app-text-muted)]">{formatWkg(pr.wkg)}</p>
              ) : null}
              <p className="text-[10px] text-zinc-500">{pr.dateLabel}</p>
            </div>
            <a
              href={`https://www.strava.com/activities/${pr.activityId}`}
              target="_blank"
              rel="noreferrer"
              className="w-full text-[10px] text-orange-400 underline sm:w-auto"
            >
              Strava →
            </a>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}

export function StravaQuarterlyPowerPanel({ quarters }: { quarters: ProgressAnalytics['quarterlyCurves'] }) {
  const withData = quarters.filter((q) => q.eftp != null)
  const colors = ['#FC4C02', '#22d3ee', '#84cc16', '#eab308']

  const chartData = useMemo(() => {
    const secondsSet = new Set<number>()
    for (const q of withData) {
      for (const p of q.curve) {
        if (p.bestWatts != null) secondsSet.add(p.seconds)
      }
    }
    const secondsList = [...secondsSet].sort((a, b) => a - b)
    return secondsList.map((seconds) => {
      const row: Record<string, number | string | null> = { seconds }
      withData.forEach((q, i) => {
        const pt = q.curve.find((p) => p.seconds === seconds)
        row[`q${i}`] = pt?.bestWatts ?? null
      })
      return row
    })
  }, [withData])

  if (withData.length === 0) return null

  return (
    <StravaCard padding="md" accent="orange">
      <StravaSectionTitle title="Power Curve · Quartale" subtitle="eFTP-Entwicklung über 4 Quartale · Log-Dauer" />
      <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-[var(--app-text-muted)]">
        {withData.map((q, i) => (
          <span key={q.quarterKey} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: colors[i % colors.length] }} />
            {q.label}
            {q.eftp ? ` (${q.eftp} W)` : ''}
          </span>
        ))}
      </div>
      <StravaChartShell height={180} minWidth={360}>
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
          <StravaTooltip formatter={(v) => `${Math.round(Number(v))} W`} />
          {withData.map((q, i) => (
            <Line
              key={q.quarterKey}
              type="monotone"
              dataKey={`q${i}`}
              name={q.label}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </ComposedChart>
      </StravaChartShell>
    </StravaCard>
  )
}

export function StravaTssAdherencePanel({ adherence, weeklyTarget }: { adherence: ProgressAnalytics['tssAdherence']; weeklyTarget: number }) {
  if (adherence.weeksTracked < 2) return null

  return (
    <StravaCard padding="md" accent="cyan">
      <StravaSectionTitle
        title="TSS-Disziplin"
        subtitle={`${adherence.weeksTracked} Wochen · Ziel ${weeklyTarget} TSS/Woche`}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Trefferquote</p>
          <p
            className={`text-2xl font-bold tabular-nums ${(adherence.adherencePct ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {adherence.adherencePct ?? '—'}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Streak</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--app-text)]">
            {adherence.currentStreakOnTarget}
          </p>
          <p className="text-[10px] text-[var(--app-text-muted)]">Wochen am Ziel</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Ø TSS/Woche</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--app-text)]">
            {adherence.avgWeeklyTss ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Beste Woche</p>
          <p className="text-lg font-bold tabular-nums text-orange-300">
            {adherence.bestWeek ? `${adherence.bestWeek.tss}` : '—'}
          </p>
          {adherence.bestWeek ? (
            <p className="text-[10px] text-[var(--app-text-muted)]">{adherence.bestWeek.label}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--app-text-muted)]">
        <span className="text-emerald-400">{adherence.weeksOnTarget}× Ziel erreicht</span>
        <span className="text-amber-400">{adherence.weeksUnder}× deutlich unter Ziel (&lt;85%)</span>
        <span>{adherence.weeksOver}× über Ziel (&gt;115%)</span>
      </div>
    </StravaCard>
  )
}

export function StravaTssBudgetPanel({ budget }: { budget: ProgressAnalytics['tssBudget'] }) {
  const chartData = useMemo(
    () =>
      budget.weeks.map((w) => ({
        label: w.label,
        tss: w.tss,
        target: w.target,
        rides: w.rides,
        over: w.tss >= w.target,
      })),
    [budget.weeks],
  )

  return (
    <StravaCard padding="md" accent="cyan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <StravaSectionTitle title="TSS-Budget" subtitle={`Wochenziel ${budget.weeklyTarget} TSS · Zoom unten`} />
        {budget.onTrackPct != null ? (
          <div className="text-right text-xs">
            <p className="text-[var(--app-text-muted)]">
              YTD {budget.ytdTss} / {budget.ytdTarget}
            </p>
            <p className={budget.onTrackPct >= 95 ? 'text-emerald-400' : 'text-amber-400'}>
              {budget.onTrackPct}% vom Soll
            </p>
          </div>
        ) : null}
      </div>

      <StravaChartShell height={200} minWidth={400}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <StravaCartesianGrid />
          <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" />
          <YAxis {...STRAVA_CHART_AXIS} width={36} />
          <StravaTooltip formatter={(v, name) => (name === 'tss' ? `${v} TSS` : `${v}`)} />
          <ReferenceLine y={budget.weeklyTarget} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
          <Bar dataKey="tss" name="TSS" radius={[2, 2, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.label} fill={entry.over ? STRAVA_COLORS.green : STRAVA_COLORS.cyan} />
            ))}
          </Bar>
          <StravaBrush />
        </ComposedChart>
      </StravaChartShell>
      <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
        Gestrichelte Linie = Wochenziel · Balken grün wenn Ziel erreicht (Hover)
      </p>
    </StravaCard>
  )
}
