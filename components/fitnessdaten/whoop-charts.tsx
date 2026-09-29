'use client'

import {
  WHOOP_ANIMATION,
  WHOOP_AXIS,
  WHOOP_CHART_MARGIN,
  WHOOP_CURSOR_BAR,
  WHOOP_CURSOR_LINE,
  WHOOP_GRID,
  WhoopAreaGradient,
  WhoopBarGradient,
  WhoopCard,
  WhoopChartShell,
  WhoopTooltipBox,
  asTooltipProps,
  formatHhMm,
  formatUhr,
  type WhoopTooltipRow,
} from '@/components/fitnessdaten/whoop-chart-kit'
import { WHOOP_COLORS, WHOOP_SLEEP_STAGES, WHOOP_ZONE_COLORS } from '@/components/fitnessdaten/whoop-design-tokens'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type BarPoint = { label: string; value: number; highlight?: boolean }

function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

function hatHighlight(points: { highlight?: boolean }[]): boolean {
  return points.some((p) => p.highlight)
}

function tickInterval(n: number): number | 'preserveStartEnd' {
  if (n <= 10) return 0
  return 'preserveStartEnd'
}

const LABEL_STYLE = { fill: WHOOP_COLORS.textMuted, fontSize: 9, fontWeight: 600 } as const

export function WhoopWeeklyBarChart({
  title,
  points,
  max,
  formatValue = (v) => String(v),
  color = WHOOP_COLORS.sleep,
  colorFor,
  onInfo,
}: {
  title: string
  points: BarPoint[]
  max?: number
  formatValue?: (v: number) => string
  color?: string
  /** Farbe pro Wert (z. B. Recovery-Ampel) — überschreibt `color`. */
  colorFor?: (v: number) => string
  onInfo?: () => void
}) {
  const gradId = useSvgId('wbar')
  const data = points.map((p) => ({ label: p.label, value: p.value > 0 ? p.value : null, highlight: p.highlight }))
  const fokus = hatHighlight(points)
  const zeigeWerte = points.length <= 12

  return (
    <WhoopCard title={title} onInfo={onInfo}>
      <WhoopChartShell height={170}>
        <BarChart data={data} margin={WHOOP_CHART_MARGIN} barCategoryGap="22%">
          <defs>
            <WhoopBarGradient id={gradId} color={color} />
          </defs>
          <CartesianGrid {...WHOOP_GRID} />
          <XAxis dataKey="label" {...WHOOP_AXIS} interval={tickInterval(points.length)} />
          <YAxis hide domain={[0, max ?? 'auto']} />
          <Tooltip
            cursor={WHOOP_CURSOR_BAR}
            content={(raw) => {
              const p = asTooltipProps(raw)
              const v = p.payload?.[0]?.value
              if (!p.active || typeof v !== 'number') return null
              return (
                <WhoopTooltipBox
                  title={String(p.label ?? '')}
                  rows={[{ label: title, value: formatValue(v), color: colorFor ? colorFor(v) : color }]}
                />
              )
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 3, 3]} minPointSize={3} {...WHOOP_ANIMATION}>
            {data.map((d, i) => (
              <Cell
                key={`${d.label}-${i}`}
                fill={colorFor && d.value != null ? colorFor(d.value) : `url(#${gradId})`}
                fillOpacity={!fokus || d.highlight ? 1 : 0.45}
              />
            ))}
            {zeigeWerte ? (
              <LabelList
                dataKey="value"
                position="top"
                offset={6}
                style={LABEL_STYLE}
                formatter={(v: unknown) => (typeof v === 'number' ? formatValue(v) : '')}
              />
            ) : null}
          </Bar>
        </BarChart>
      </WhoopChartShell>
    </WhoopCard>
  )
}

export function WhoopWeeklyLineChart({
  title,
  points,
  color = WHOOP_COLORS.sleep,
  formatValue = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
  onInfo,
}: {
  title: string
  points: BarPoint[]
  color?: string
  formatValue?: (v: number) => string
  onInfo?: () => void
}) {
  const gradId = useSvgId('wline')
  const data = points.map((p) => ({ label: p.label, value: p.value > 0 ? p.value : null, highlight: p.highlight }))
  const werte = data.map((d) => d.value).filter((v): v is number => v != null)
  const zeigeWerte = werte.length > 0 && werte.length <= 10

  return (
    <WhoopCard title={title} onInfo={onInfo}>
      <WhoopChartShell height={170}>
        <AreaChart data={data} margin={WHOOP_CHART_MARGIN}>
          <defs>
            <WhoopAreaGradient id={gradId} color={color} />
          </defs>
          <CartesianGrid {...WHOOP_GRID} />
          <XAxis dataKey="label" {...WHOOP_AXIS} interval={tickInterval(points.length)} />
          <YAxis hide domain={[(min: number) => min * 0.9, (max: number) => max * 1.08]} />
          <Tooltip
            cursor={WHOOP_CURSOR_LINE}
            content={(raw) => {
              const p = asTooltipProps(raw)
              const v = p.payload?.[0]?.value
              if (!p.active || typeof v !== 'number') return null
              return (
                <WhoopTooltipBox title={String(p.label ?? '')} rows={[{ label: title, value: formatValue(v), color }]} />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradId})`}
            connectNulls
            dot={{ r: 2.5, fill: color, stroke: WHOOP_COLORS.surface, strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: color, stroke: WHOOP_COLORS.surface, strokeWidth: 2 }}
            {...WHOOP_ANIMATION}
          >
            {zeigeWerte ? (
              <LabelList
                dataKey="value"
                position="top"
                offset={8}
                style={{ ...LABEL_STYLE, fill: color }}
                formatter={(v: unknown) => (typeof v === 'number' ? formatValue(v) : '')}
              />
            ) : null}
          </Area>
        </AreaChart>
      </WhoopChartShell>
    </WhoopCard>
  )
}

type ZoneDef = { key: string; label: string; color: string }

export function WhoopStackedZoneChart({
  title,
  points,
  zones,
  onInfo,
}: {
  title: string
  points: { label: string; segments: { key: string; min: number; color: string }[]; highlight?: boolean }[]
  zones: ZoneDef[]
  onInfo?: () => void
}) {
  const fokus = hatHighlight(points)
  const data = points.map((p) => {
    const row: Record<string, string | number | boolean | undefined> = { label: p.label, highlight: p.highlight }
    let total = 0
    for (const s of p.segments) {
      row[s.key] = s.min
      total += s.min
    }
    row.total = total
    return row
  })
  const topKey = zones[zones.length - 1]?.key

  return (
    <WhoopCard title={title} onInfo={onInfo} legend={zones.map((z) => ({ label: z.label, color: z.color }))}>
      <WhoopChartShell height={170}>
        <BarChart data={data} margin={WHOOP_CHART_MARGIN} barCategoryGap="22%">
          <CartesianGrid {...WHOOP_GRID} />
          <XAxis dataKey="label" {...WHOOP_AXIS} interval={tickInterval(points.length)} />
          <YAxis hide />
          <Tooltip
            cursor={WHOOP_CURSOR_BAR}
            content={(raw) => {
              const p = asTooltipProps(raw)
              if (!p.active || !p.payload?.length) return null
              const row = p.payload[0]?.payload ?? {}
              const rows: WhoopTooltipRow[] = zones.map((z) => ({
                label: z.label,
                value: formatHhMm(Number(row[z.key] ?? 0)),
                color: z.color,
              }))
              rows.push({ label: 'Gesamt', value: formatHhMm(Number(row.total ?? 0)) })
              return <WhoopTooltipBox title={String(p.label ?? '')} rows={rows} />
            }}
          />
          {zones.map((z) => (
            <Bar
              key={z.key}
              dataKey={z.key}
              stackId="zones"
              fill={z.color}
              radius={z.key === topKey ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              {...WHOOP_ANIMATION}
            >
              {data.map((d, i) => (
                <Cell key={`${z.key}-${i}`} fillOpacity={!fokus || d.highlight ? 1 : 0.45} />
              ))}
              {z.key === topKey ? (
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={6}
                  style={LABEL_STYLE}
                  formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? formatHhMm(v) : '')}
                />
              ) : null}
            </Bar>
          ))}
        </BarChart>
      </WhoopChartShell>
    </WhoopCard>
  )
}

export const WHOOP_ZONE_13 = [
  { key: 'z1', label: 'Zone 1', color: WHOOP_ZONE_COLORS.z1 },
  { key: 'z2', label: 'Zone 2', color: WHOOP_ZONE_COLORS.z2 },
  { key: 'z3', label: 'Zone 3', color: WHOOP_ZONE_COLORS.z3 },
]

export const WHOOP_ZONE_45 = [
  { key: 'z4', label: 'Zone 4', color: WHOOP_ZONE_COLORS.z4 },
  { key: 'z5', label: 'Zone 5', color: WHOOP_ZONE_COLORS.z5 },
]

/** Zwei Serien: A als Fläche mit Verlauf, B als gestrichelte Referenzlinie (z. B. Bedarf). */
export function WhoopDualLineChart({
  title,
  seriesA,
  seriesB,
  labelA,
  labelB,
  colorA = WHOOP_COLORS.sleep,
  colorB = 'rgba(255,255,255,0.55)',
  formatValue = (v) => String(v),
  onInfo,
}: {
  title: string
  seriesA: BarPoint[]
  seriesB: BarPoint[]
  labelA: string
  labelB: string
  colorA?: string
  colorB?: string
  formatValue?: (v: number) => string
  onInfo?: () => void
}) {
  const gradId = useSvgId('wdual')
  const data = seriesA.map((p, i) => ({
    label: p.label,
    a: p.value > 0 ? p.value : null,
    b: (seriesB[i]?.value ?? 0) > 0 ? seriesB[i]!.value : null,
  }))

  return (
    <WhoopCard
      title={title}
      onInfo={onInfo}
      legend={[
        { label: labelA, color: colorA },
        { label: labelB, color: colorB, dashed: true },
      ]}
    >
      <WhoopChartShell height={170}>
        <ComposedChart data={data} margin={WHOOP_CHART_MARGIN}>
          <defs>
            <WhoopAreaGradient id={gradId} color={colorA} />
          </defs>
          <CartesianGrid {...WHOOP_GRID} />
          <XAxis dataKey="label" {...WHOOP_AXIS} interval={tickInterval(seriesA.length)} />
          <YAxis hide domain={[(min: number) => min * 0.85, (max: number) => max * 1.08]} />
          <Tooltip
            cursor={WHOOP_CURSOR_LINE}
            content={(raw) => {
              const p = asTooltipProps(raw)
              if (!p.active || !p.payload?.length) return null
              const row = p.payload[0]?.payload ?? {}
              const rows: WhoopTooltipRow[] = []
              if (typeof row.a === 'number') rows.push({ label: labelA, value: formatValue(row.a), color: colorA })
              if (typeof row.b === 'number') rows.push({ label: labelB, value: formatValue(row.b), color: colorB })
              return <WhoopTooltipBox title={String(p.label ?? '')} rows={rows} />
            }}
          />
          <Area
            type="monotone"
            dataKey="a"
            name={labelA}
            stroke={colorA}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill={`url(#${gradId})`}
            connectNulls
            dot={{ r: 2.5, fill: colorA, stroke: WHOOP_COLORS.surface, strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: colorA, stroke: WHOOP_COLORS.surface, strokeWidth: 2 }}
            {...WHOOP_ANIMATION}
          />
          <Line
            type="monotone"
            dataKey="b"
            name={labelB}
            stroke={colorB}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, fill: colorB, stroke: WHOOP_COLORS.surface, strokeWidth: 2 }}
            connectNulls
            {...WHOOP_ANIMATION}
          />
        </ComposedChart>
      </WhoopChartShell>
    </WhoopCard>
  )
}

/** Minuten seit 18:00 — damit Einschlafen vor/nach Mitternacht auf einer Achse liegt. */
const ANKER_MIN = 18 * 60

function minSeitAnker(ms: number): number {
  const d = new Date(ms)
  return (d.getHours() * 60 + d.getMinutes() - ANKER_MIN + 1440) % 1440
}

function ankerZuUhr(v: number): string {
  const m = Math.round(v + ANKER_MIN) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Schlaffenster als schwebender Balken: Einschlafen (oben) → Aufwachen (unten). */
export function WhoopTimeInBedChart({
  title,
  points,
  onInfo,
}: {
  title: string
  points: { label: string; bedMs: number | null; wakeMs: number | null; highlight?: boolean }[]
  onInfo?: () => void
}) {
  const gradId = useSvgId('wbed')
  const fokus = hatHighlight(points)
  const data = points.map((p) => {
    if (p.bedMs == null || p.wakeMs == null) return { label: p.label, range: null, highlight: p.highlight, bedMs: null, wakeMs: null }
    const start = minSeitAnker(p.bedMs)
    let end = minSeitAnker(p.wakeMs)
    if (end <= start) end += 1440
    return { label: p.label, range: [start, end] as [number, number], highlight: p.highlight, bedMs: p.bedMs, wakeMs: p.wakeMs }
  })
  const alle = data.flatMap((d) => d.range ?? [])
  const lo = alle.length ? Math.max(0, Math.floor((Math.min(...alle) - 30) / 60) * 60) : 240
  const hi = alle.length ? Math.ceil((Math.max(...alle) + 30) / 60) * 60 : 840
  const ticks: number[] = []
  for (let t = lo; t <= hi; t += 120) ticks.push(t)

  return (
    <WhoopCard title={title} onInfo={onInfo}>
      <WhoopChartShell height={190}>
        <BarChart data={data} margin={{ ...WHOOP_CHART_MARGIN, left: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WHOOP_SLEEP_STAGES.deep.color} />
              <stop offset="100%" stopColor={WHOOP_COLORS.sleep} />
            </linearGradient>
          </defs>
          <CartesianGrid {...WHOOP_GRID} />
          <XAxis dataKey="label" {...WHOOP_AXIS} interval={tickInterval(points.length)} />
          <YAxis
            {...WHOOP_AXIS}
            reversed
            width={38}
            domain={[lo, hi]}
            ticks={ticks}
            tickFormatter={(v: number) => ankerZuUhr(v)}
          />
          <Tooltip
            cursor={WHOOP_CURSOR_BAR}
            content={(raw) => {
              const p = asTooltipProps(raw)
              const row = p.payload?.[0]?.payload
              if (!p.active || !row || typeof row.bedMs !== 'number' || typeof row.wakeMs !== 'number') return null
              const r = row.range as [number, number]
              return (
                <WhoopTooltipBox
                  title={String(p.label ?? '')}
                  rows={[
                    { label: 'Eingeschlafen', value: formatUhr(row.bedMs), color: WHOOP_SLEEP_STAGES.deep.color },
                    { label: 'Aufgewacht', value: formatUhr(row.wakeMs), color: WHOOP_COLORS.sleep },
                    { label: 'Im Bett', value: formatHhMm(r[1] - r[0]) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="range" radius={[8, 8, 8, 8]} fill={`url(#${gradId})`} {...WHOOP_ANIMATION}>
            {data.map((d, i) => (
              <Cell key={`${d.label}-${i}`} fillOpacity={!fokus || d.highlight ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </WhoopChartShell>
    </WhoopCard>
  )
}

/** Erholsamer Schlaf: Tief (unten) + REM (oben) gestapelt. */
export function WhoopRestorativeChart({
  title,
  points,
  onInfo,
}: {
  title: string
  points: { label: string; remMin: number; deepMin: number; highlight?: boolean }[]
  onInfo?: () => void
}) {
  const fokus = hatHighlight(points)
  const deep = WHOOP_SLEEP_STAGES.deep
  const rem = WHOOP_SLEEP_STAGES.rem
  const data = points.map((p) => ({
    label: p.label,
    deep: p.deepMin,
    rem: p.remMin,
    total: p.deepMin + p.remMin,
    highlight: p.highlight,
  }))

  return (
    <WhoopCard
      title={title}
      onInfo={onInfo}
      legend={[
        { label: rem.label, color: rem.color },
        { label: deep.label, color: deep.color },
      ]}
    >
      <WhoopChartShell height={170}>
        <BarChart data={data} margin={WHOOP_CHART_MARGIN} barCategoryGap="22%">
          <CartesianGrid {...WHOOP_GRID} />
          <XAxis dataKey="label" {...WHOOP_AXIS} interval={tickInterval(points.length)} />
          <YAxis hide />
          <Tooltip
            cursor={WHOOP_CURSOR_BAR}
            content={(raw) => {
              const p = asTooltipProps(raw)
              const row = p.payload?.[0]?.payload
              if (!p.active || !row) return null
              return (
                <WhoopTooltipBox
                  title={String(p.label ?? '')}
                  rows={[
                    { label: rem.label, value: formatHhMm(Number(row.rem ?? 0)), color: rem.color },
                    { label: deep.label, value: formatHhMm(Number(row.deep ?? 0)), color: deep.color },
                    { label: 'Erholsam', value: formatHhMm(Number(row.total ?? 0)) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="deep" stackId="rest" fill={deep.color} {...WHOOP_ANIMATION}>
            {data.map((d, i) => (
              <Cell key={`d-${i}`} fillOpacity={!fokus || d.highlight ? 1 : 0.45} />
            ))}
          </Bar>
          <Bar dataKey="rem" stackId="rest" fill={rem.color} radius={[6, 6, 0, 0]} {...WHOOP_ANIMATION}>
            {data.map((d, i) => (
              <Cell key={`r-${i}`} fillOpacity={!fokus || d.highlight ? 1 : 0.45} />
            ))}
            <LabelList
              dataKey="total"
              position="top"
              offset={6}
              style={LABEL_STYLE}
              formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? formatHhMm(v) : '')}
            />
          </Bar>
        </BarChart>
      </WhoopChartShell>
    </WhoopCard>
  )
}
