'use client'

import { WhoopChartHeader } from '@/components/fitnessdaten/whoop-info-modal'
import { HR_ZONE_COLORS } from '@/lib/fitnessdaten/types'

type BarPoint = { label: string; value: number; highlight?: boolean }

export function WhoopWeeklyBarChart({
  title,
  points,
  max,
  formatValue = (v) => String(v),
  color = '#5eb3d6',
  onInfo,
}: {
  title: string
  points: BarPoint[]
  max?: number
  formatValue?: (v: number) => string
  color?: string
  onInfo?: () => void
}) {
  const peak = max ?? Math.max(...points.map((p) => p.value), 1)
  const h = 140

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <svg viewBox={`0 0 360 ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            y1={h - 24 - f * (h - 40)}
            x2={360}
            y2={h - 24 - f * (h - 40)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {points.map((p, i) => {
          const barW = 360 / points.length - 8
          const x = i * (360 / points.length) + 4
          const barH = peak > 0 ? (p.value / peak) * (h - 48) : 0
          return (
            <g key={p.label}>
              {p.highlight ? (
                <rect x={x - 2} y={8} width={barW + 4} height={h - 16} rx={6} fill="rgba(255,255,255,0.04)" />
              ) : null}
              <text x={x + barW / 2} y={14} textAnchor="middle" fill={color} fontSize="10" fontWeight="600">
                {formatValue(p.value)}
              </text>
              <rect
                x={x}
                y={h - 24 - barH}
                width={barW}
                height={Math.max(barH, p.value > 0 ? 4 : 0)}
                rx={3}
                fill={color}
              />
              <text x={x + barW / 2} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="9">
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function WhoopWeeklyLineChart({
  title,
  points,
  color = '#5eb3d6',
  onInfo,
}: {
  title: string
  points: BarPoint[]
  color?: string
  onInfo?: () => void
}) {
  const h = 120
  const vals = points.map((p) => p.value).filter((v) => v > 0)
  const min = vals.length ? Math.min(...vals) * 0.85 : 0
  const max = vals.length ? Math.max(...vals) * 1.1 : 1
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = 20 + (i / Math.max(points.length - 1, 1)) * 320
    const y = 16 + (1 - (p.value - min) / range) * (h - 36)
    return { x, y, ...p }
  })

  const poly = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const last = coords[coords.length - 1]

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <svg viewBox={`0 0 360 ${h}`} className="w-full">
        <polyline points={poly} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {coords.map((c) => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r={4} fill={color} />
            <text x={c.x} y={c.y - 8} textAnchor="middle" fill={color} fontSize="9">
              {c.value}
            </text>
            <text x={c.x} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="8">
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function WhoopStackedZoneChart({
  title,
  points,
  zones,
  onInfo,
}: {
  title: string
  points: { label: string; segments: { key: string; min: number; color: string }[]; highlight?: boolean }[]
  zones: { key: string; label: string; color: string }[]
  onInfo?: () => void
}) {
  const h = 130
  const peak = Math.max(...points.map((p) => p.segments.reduce((a, s) => a + s.min, 0)), 0.01)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <div className="mt-2 flex flex-wrap gap-3 text-[9px] text-zinc-500">
        {zones.map((z) => (
          <span key={z.key} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: z.color }} />
            {z.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 360 ${h}`} className="mt-2 w-full">
        {points.map((p, i) => {
          const barW = 360 / points.length - 8
          const x = i * (360 / points.length) + 4
          const total = p.segments.reduce((a, s) => a + s.min, 0)
          let yOff = h - 20
          return (
            <g key={p.label}>
              {p.highlight ? (
                <rect x={x - 2} y={8} width={barW + 4} height={h - 16} rx={6} fill="rgba(255,255,255,0.04)" />
              ) : null}
              <text x={x + barW / 2} y={14} textAnchor="middle" fill="#a1a1aa" fontSize="9">
                {total > 0 ? `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}` : '0:00'}
              </text>
              {p.segments.map((s) => {
                const segH = (s.min / peak) * (h - 44)
                yOff -= segH
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={yOff}
                    width={barW}
                    height={Math.max(segH, s.min > 0 ? 2 : 0)}
                    fill={s.color}
                    rx={1}
                  />
                )
              })}
              <text x={x + barW / 2} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="8">
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export const WHOOP_ZONE_13 = [
  { key: 'z1', label: 'Zone 1', color: HR_ZONE_COLORS.z1 },
  { key: 'z2', label: 'Zone 2', color: HR_ZONE_COLORS.z2 },
  { key: 'z3', label: 'Zone 3', color: HR_ZONE_COLORS.z3 },
]

export const WHOOP_ZONE_45 = [
  { key: 'z4', label: 'Zone 4', color: HR_ZONE_COLORS.z4 },
  { key: 'z5', label: 'Zone 5', color: HR_ZONE_COLORS.z5 },
]

/** Zwei Linien: z. B. geschlafen vs. Bedarf (Minuten). */
export function WhoopDualLineChart({
  title,
  seriesA,
  seriesB,
  labelA,
  labelB,
  colorA = '#5eb3d6',
  colorB = '#2dd4a8',
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
  const h = 130
  const all = [...seriesA, ...seriesB].map((p) => p.value).filter((v) => v > 0)
  const min = all.length ? Math.min(...all) * 0.9 : 0
  const max = all.length ? Math.max(...all) * 1.05 : 480
  const range = max - min || 1

  const line = (pts: BarPoint[], color: string) => {
    const coords = pts.map((p, i) => {
      const x = 20 + (i / Math.max(pts.length - 1, 1)) * 320
      const y = 20 + (1 - (p.value - min) / range) * (h - 44)
      return { x, y, ...p }
    })
    return (
      <g>
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        {coords.map((c) => (
          <g key={`${color}-${c.label}`}>
            <circle cx={c.x} cy={c.y} r={3} fill={color} />
            <text x={c.x} y={c.y - 6} textAnchor="middle" fill={color} fontSize="8">
              {formatValue(c.value)}
            </text>
          </g>
        ))}
      </g>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <div className="mb-2 flex gap-4 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: colorA }} />
          {labelA}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: colorB }} />
          {labelB}
        </span>
      </div>
      <svg viewBox={`0 0 360 ${h}`} className="w-full">
        {line(seriesA, colorA)}
        {line(seriesB, colorB)}
        {seriesA.map((p, i) => {
          const x = 20 + (i / Math.max(seriesA.length - 1, 1)) * 320
          return (
            <text key={p.label} x={x} y={h - 2} textAnchor="middle" fill="#71717a" fontSize="8">
              {p.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

/** Bett-/Weckzeit als vertikaler Balken. */
export function WhoopTimeInBedChart({
  title,
  points,
  onInfo,
}: {
  title: string
  points: { label: string; bedMs: number | null; wakeMs: number | null; highlight?: boolean }[]
  onInfo?: () => void
}) {
  const h = 140
  const fmt = (ms: number | null) =>
    ms != null
      ? new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '—'

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <svg viewBox={`0 0 360 ${h}`} className="w-full">
        {points.map((p, i) => {
          const barW = 360 / points.length - 8
          const x = i * (360 / points.length) + 4
          const has = p.bedMs != null && p.wakeMs != null
          const barH = has ? 60 : 4
          return (
            <g key={p.label}>
              {p.highlight ? (
                <rect x={x - 2} y={8} width={barW + 4} height={h - 16} rx={6} fill="rgba(255,255,255,0.04)" />
              ) : null}
              <text x={x + barW / 2} y={16} textAnchor="middle" fill="#5eb3d6" fontSize="8">
                {fmt(p.bedMs)}
              </text>
              <rect x={x} y={28} width={barW} height={barH} rx={3} fill="#5eb3d6" opacity={has ? 1 : 0.2} />
              <text x={x + barW / 2} y={28 + barH + 12} textAnchor="middle" fill="#a1a1aa" fontSize="8">
                {fmt(p.wakeMs)}
              </text>
              <text x={x + barW / 2} y={h - 2} textAnchor="middle" fill="#71717a" fontSize="8">
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** REM + Tiefschlaf gestapelt. */
export function WhoopRestorativeChart({
  title,
  points,
  onInfo,
}: {
  title: string
  points: {
    label: string
    remMin: number
    deepMin: number
    highlight?: boolean
  }[]
  onInfo?: () => void
}) {
  const h = 130
  const peak = Math.max(...points.map((p) => p.remMin + p.deepMin), 1)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141618] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <div className="mb-2 flex gap-4 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#a78bfa]" />
          REM
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#f472b6]" />
          Tief
        </span>
      </div>
      <svg viewBox={`0 0 360 ${h}`} className="w-full">
        {points.map((p, i) => {
          const barW = 360 / points.length - 8
          const x = i * (360 / points.length) + 4
          const total = p.remMin + p.deepMin
          const remH = (p.remMin / peak) * (h - 44)
          const deepH = (p.deepMin / peak) * (h - 44)
          return (
            <g key={p.label}>
              {p.highlight ? (
                <rect x={x - 2} y={8} width={barW + 4} height={h - 16} rx={6} fill="rgba(255,255,255,0.04)" />
              ) : null}
              <text x={x + barW / 2} y={14} textAnchor="middle" fill="#a1a1aa" fontSize="8">
                {total > 0
                  ? `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`
                  : '0:00'}
              </text>
              <rect x={x} y={h - 20 - remH - deepH} width={barW} height={Math.max(remH, 0)} fill="#a78bfa" />
              <rect x={x} y={h - 20 - deepH} width={barW} height={Math.max(deepH, 0)} fill="#f472b6" />
              <text x={x + barW / 2} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="8">
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
