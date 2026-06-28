'use client'

import { StravaChartHoverInfo } from '@/components/strava/strava-chart-utils'
import { ComposedChart, Line, XAxis, YAxis, ReferenceLine } from 'recharts'
import {
  StravaCartesianGrid,
  StravaChartShell,
  StravaTooltip,
  STRAVA_CHART_AXIS,
} from '@/components/strava/strava-recharts'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type {
  AdvancedMetrics,
  DecouplingTrendPoint,
  GearStat,
  TrainingHeatmap,
} from '@/lib/strava/strava-advanced-metrics'
import { useMemo, useState } from 'react'

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function intensityColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(255,255,255,0.04)'
  const t = Math.min(1, intensity)
  const r = Math.round(234 - t * 80)
  const g = Math.round(88 + t * 40)
  const b = Math.round(12 + t * 20)
  return `rgba(${r},${g},${b},${0.35 + t * 0.55})`
}

export function StravaHeatmapPanel({ heatmap }: { heatmap: TrainingHeatmap }) {
  const [hover, setHover] = useState<string | null>(null)
  const hoverCell = hover ? heatmap.cells.find((c) => c.label === hover) : null

  return (
    <StravaCard padding="md" accent="orange">
      <StravaSectionTitle title="Trainings-Heatmap" subtitle={`${heatmap.weeks} Wochen · Stunden pro Tag`} />
      <StravaChartHoverInfo>
        {hoverCell ? (
          <span>
            <strong>{hoverCell.label}</strong> — {hoverCell.hours} h · {hoverCell.rides} Fahrten · TSS{' '}
            {hoverCell.tss}
          </span>
        ) : (
          'Über ein Feld fahren für Details'
        )}
      </StravaChartHoverInfo>
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-0 flex-col gap-1">
          <div className="flex gap-1 pl-8">
            {DAY_LABELS.map((d) => (
              <span key={d} className="w-7 text-center text-[9px] text-[var(--app-text-muted)]">
                {d}
              </span>
            ))}
          </div>
          {Array.from({ length: heatmap.weeks }, (_, wi) => (
            <div key={wi} className="flex items-center gap-1">
              <span className="w-7 text-right text-[9px] text-[var(--app-text-muted)]">W{wi + 1}</span>
              {Array.from({ length: 7 }, (_, day) => {
                const cell = heatmap.cells.find((c) => c.weekIndex === wi && c.day === day)
                if (!cell) return <div key={day} className="h-7 w-7 rounded-sm bg-white/[0.03]" />
                return (
                  <div
                    key={day}
                    title={cell.label}
                    className="h-7 w-7 rounded-sm transition-transform hover:scale-110"
                    style={{ background: intensityColor(cell.intensity) }}
                    onMouseEnter={() => setHover(cell.label)}
                    onMouseLeave={() => setHover(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </StravaCard>
  )
}

export function StravaDecouplingPanel({
  trend,
  avgDecoupling,
  avgVi,
  backlog,
}: {
  trend: DecouplingTrendPoint[]
  avgDecoupling: number | null
  avgVi: number | null
  backlog: number
}) {
  const withDec = trend.filter((p) => p.decouplingPct != null)
  const chartData = useMemo(
    () =>
      withDec.map((p) => ({
        label: p.label,
        name: p.name,
        decoupling: p.decouplingPct,
        vi: p.vi,
        activityId: p.activityId,
      })),
    [withDec],
  )

  return (
    <StravaCard padding="md" accent="cyan">
      <StravaSectionTitle
        title="Aerobe Dekoupling & VI"
        subtitle="HR-Drift bei langer Ausdauer (>45 min)"
      />
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        {avgDecoupling != null ? (
          <span>
            Ø Dekoupling:{' '}
            <strong className={avgDecoupling > 5 ? 'text-amber-400' : 'text-emerald-400'}>
              {avgDecoupling}%
            </strong>
          </span>
        ) : null}
        {avgVi != null ? (
          <span>
            Ø VI: <strong className="text-[var(--app-text)]">{avgVi.toFixed(2)}</strong>
          </span>
        ) : null}
        {backlog > 0 ? (
          <span className="text-[var(--app-text-muted)]">{backlog} Fahrten warten auf Stream-Analyse</span>
        ) : null}
      </div>

      {withDec.length < 2 ? (
        <p className="text-sm text-[var(--app-text-muted)]">
          Mindestens zwei lange Fahrten mit Power + HR nötig — Sync mehrfach ausführen.
        </p>
      ) : (
        <>
          <StravaChartShell height={180} minWidth={360}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <StravaCartesianGrid />
              <XAxis dataKey="label" {...STRAVA_CHART_AXIS} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...STRAVA_CHART_AXIS} width={36} unit=" %" domain={[0, 'auto']} />
              <StravaTooltip
                formatter={(v) => `${Number(v).toFixed(1)}%`}
                labelFormatter={(_, payload) => {
                  const row = (payload?.[0] as { payload?: { label?: string; name?: string; vi?: number | null } })
                    ?.payload
                  if (!row) return ''
                  const base = row.name ? `${row.label} · ${row.name}` : String(row.label ?? '')
                  return row.vi != null ? `${base} · VI ${row.vi.toFixed(2)}` : base
                }}
              />
              <ReferenceLine y={5} stroke="rgba(234,179,8,0.45)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="decoupling"
                name="Dekoupling"
                stroke={STRAVA_COLORS.cyan}
                strokeWidth={2}
                dot={{ r: 4, fill: STRAVA_COLORS.cyan }}
              />
            </ComposedChart>
          </StravaChartShell>
          <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
            Gelbe Linie = 5 % Schwelle · Unter 5 % = gute aerobe Effizienz
          </p>
        </>
      )}
    </StravaCard>
  )
}

export function StravaGearSplitPanel({ gear }: { gear: GearStat[] }) {
  if (gear.length === 0 || (gear.length === 1 && gear[0].gearId === 0)) {
    return (
      <StravaCard padding="md">
        <StravaSectionTitle title="Bike-Split" subtitle="Km & Leistung pro Gear" />
        <p className="text-sm text-[var(--app-text-muted)]">Keine Gear-Daten in Strava-Aktivitäten.</p>
      </StravaCard>
    )
  }

  const maxKm = Math.max(...gear.map((g) => g.km), 1)

  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Bike-Split" subtitle="Km & Leistung pro Gear" />
      <div className="space-y-3">
        {gear.map((g) => (
          <div key={g.gearId}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-[var(--app-text)]">{g.label}</span>
              <span className="text-[var(--app-text-muted)]">
                {g.km.toLocaleString('de-DE')} km · {g.rides}× · {g.hours} h
                {g.avgWatts != null ? ` · Ø ${g.avgWatts} W` : ''}
                {g.avgWkg != null ? ` (${g.avgWkg} W/kg)` : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(g.km / maxKm) * 100}%`,
                  background: STRAVA_COLORS.orange,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}

export function StravaAdvancedSection({ advanced }: { advanced: AdvancedMetrics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StravaHeatmapPanel heatmap={advanced.heatmap} />
      <StravaDecouplingPanel
        trend={advanced.decouplingTrend}
        avgDecoupling={advanced.avgDecoupling}
        avgVi={advanced.avgVi}
        backlog={advanced.decouplingBacklog}
      />
      <div className="lg:col-span-2">
        <StravaGearSplitPanel gear={advanced.gearSplit} />
      </div>
    </div>
  )
}
