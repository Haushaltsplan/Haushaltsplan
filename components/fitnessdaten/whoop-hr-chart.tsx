'use client'

import {
  WHOOP_AXIS,
  WHOOP_CURSOR_LINE,
  WHOOP_GRID,
  WhoopChartShell,
  WhoopTooltipBox,
  asTooltipProps,
  formatUhr,
} from '@/components/fitnessdaten/whoop-chart-kit'
import { WHOOP_COLORS, WHOOP_ZONE_COLORS } from '@/components/fitnessdaten/whoop-design-tokens'
import { zoneFuerBpm } from '@/lib/fitnessdaten/scores'
import { HR_ZONE_LABELS, type FitnessHrPoint, type HrZoneKey } from '@/lib/fitnessdaten/types'
import { ladeFitnessProfil, profilMaxHr } from '@/lib/fitnessdaten/user-profile'
import { useId, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'

type Props = {
  points: FitnessHrPoint[]
  height?: number
  live?: boolean
  restingHr?: number | null
}

/** Untergrenzen der Zonen in % der HF-Reserve — deckungsgleich mit `zoneFuerBpm`. */
const ZONE_GRENZEN: { key: HrZoneKey; minPct: number }[] = [
  { key: 'rest', minPct: 0 },
  { key: 'z1', minPct: 0.5 },
  { key: 'z2', minPct: 0.6 },
  { key: 'z3', minPct: 0.7 },
  { key: 'z4', minPct: 0.8 },
  { key: 'z5', minPct: 0.9 },
]

type ZoneBand = { key: HrZoneKey; lo: number; hi: number }

function zonenBaender(maxHr: number, resting: number): ZoneBand[] {
  const reserve = Math.max(maxHr - resting, 40)
  return ZONE_GRENZEN.map((z, i) => ({
    key: z.key,
    lo: resting + z.minPct * reserve,
    hi: i < ZONE_GRENZEN.length - 1 ? resting + ZONE_GRENZEN[i + 1]!.minPct * reserve : 250,
  }))
}

/** Stufiger Verlauf: oben = höchster Puls. Offsets relativ zum Datenbereich [lo, hi]. */
function zonenStops(baender: ZoneBand[], lo: number, hi: number) {
  const span = hi - lo
  const off = (bpm: number) => Math.min(1, Math.max(0, (hi - bpm) / span))
  const stops: { offset: number; color: string }[] = []
  for (const b of [...baender].reverse()) {
    if (b.hi <= lo || b.lo >= hi) continue
    const color = WHOOP_ZONE_COLORS[b.key]
    stops.push({ offset: off(Math.min(b.hi, hi)), color })
    stops.push({ offset: off(Math.max(b.lo, lo)), color })
  }
  return stops
}

export function WhoopHrChart({ points, height = 150, live = false, restingHr }: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const strokeId = `whr-s-${rawId}`
  const fillId = `whr-f-${rawId}`

  const maxHr = useMemo(() => {
    try {
      return profilMaxHr(ladeFitnessProfil())
    } catch {
      return 190
    }
  }, [])

  const bpms = points.map((p) => p.bpm)
  const lo = bpms.length ? Math.min(...bpms) : 50
  const hi = bpms.length ? Math.max(...bpms) : 120
  const resting = restingHr && restingHr > 30 ? restingHr : Math.max(40, Math.min(70, lo))
  const baender = useMemo(() => zonenBaender(maxHr, resting), [maxHr, resting])
  const flach = hi - lo < 4
  const stops = flach ? [] : zonenStops(baender, lo, hi)
  const flachFarbe = WHOOP_ZONE_COLORS[zoneFuerBpm(hi, maxHr, resting)]
  const sichtbareBaender = baender.filter((b) => b.key !== 'rest' && b.hi > lo - 6 && b.lo < hi + 6)

  if (points.length < 2) {
    return (
      <div
        className="mt-3 flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]"
        style={{ height }}
      >
        <p className="text-xs text-[#8B93A1]">{live ? 'Warte auf Pulsdaten …' : 'Kein Verlauf — Band verbinden'}</p>
      </div>
    )
  }

  const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)
  const letzter = points[points.length - 1]!.bpm
  const letzteZone = zoneFuerBpm(letzter, maxHr, resting)

  return (
    <div className="mt-3">
      <WhoopChartShell height={height}>
        <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
              {stops.map((s, i) => (
                <stop key={`s${i}`} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              {stops.map((s, i) => (
                <stop key={`f${i}`} offset={s.offset} stopColor={s.color} stopOpacity={0.22 * (1 - s.offset * 0.8)} />
              ))}
            </linearGradient>
          </defs>
          <CartesianGrid {...WHOOP_GRID} />
          {sichtbareBaender.map((b) => (
            <ReferenceArea
              key={b.key}
              y1={Math.max(b.lo, lo)}
              y2={Math.min(b.hi, hi)}
              fill={WHOOP_ZONE_COLORS[b.key]}
              fillOpacity={0.04}
              stroke="none"
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            {...WHOOP_AXIS}
            tickFormatter={(t: number) => formatUhr(t)}
            minTickGap={48}
          />
          {/* Exakter Datenbereich, damit objectBoundingBox-Verläufe mit den Zonengrenzen übereinstimmen. */}
          <YAxis hide domain={[lo, hi]} />
          <Tooltip
            cursor={WHOOP_CURSOR_LINE}
            content={(raw) => {
              const p = asTooltipProps(raw)
              const row = p.payload?.[0]?.payload
              if (!p.active || !row || typeof row.bpm !== 'number' || typeof row.t !== 'number') return null
              const z = zoneFuerBpm(row.bpm, maxHr, resting)
              return (
                <WhoopTooltipBox
                  title={formatUhr(row.t)}
                  rows={[
                    { label: 'Herzfrequenz', value: `${row.bpm} bpm`, color: WHOOP_ZONE_COLORS[z] },
                    { label: 'Zone', value: HR_ZONE_LABELS[z], color: WHOOP_ZONE_COLORS[z] },
                  ]}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="bpm"
            baseValue={lo}
            stroke={flach ? flachFarbe : `url(#${strokeId})`}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={flach ? flachFarbe : `url(#${fillId})`}
            fillOpacity={flach ? 0.12 : 1}
            dot={false}
            activeDot={{ r: 4.5, stroke: WHOOP_COLORS.surface, strokeWidth: 2 }}
            isAnimationActive={!live}
            animationDuration={900}
          />
        </AreaChart>
      </WhoopChartShell>

      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Min', value: lo },
          { label: 'Ø', value: avg },
          { label: 'Max', value: hi },
          { label: live ? 'Live' : 'Letzter', value: letzter, color: WHOOP_ZONE_COLORS[letzteZone] },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-white/[0.03] py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">{k.label}</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: k.color ?? WHOOP_COLORS.text }}>
              {k.value}
              <span className="ml-0.5 text-[9px] font-medium text-[#6B7280]">bpm</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
