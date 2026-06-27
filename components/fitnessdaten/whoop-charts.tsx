'use client'

import { WhoopChartHeader } from '@/components/fitnessdaten/whoop-info-modal'
import { HR_ZONE_COLORS } from '@/lib/fitnessdaten/types'

type BarPoint = { label: string; value: number; highlight?: boolean }

function chartBreite(punkte: number): number {
  return Math.max(360, punkte * 28)
}

function labelSchritt(anzahl: number): number {
  if (anzahl <= 10) return 1
  if (anzahl <= 30) return 2
  if (anzahl <= 60) return 5
  return 14
}

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
  const sichtbar = points.filter((p) => p.value > 0)
  const peak = max ?? Math.max(...sichtbar.map((p) => p.value), 1)
  const h = 160
  const w = chartBreite(sichtbar.length || points.length)
  const n = sichtbar.length || 1
  const schritt = labelSchritt(n)
  const werteAnzeigen = n <= 12

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          style={{ minWidth: w, width: '100%', height: h }}
          preserveAspectRatio="xMinYMid meet"
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              y1={h - 28 - f * (h - 52)}
              x2={w}
              y2={h - 28 - f * (h - 52)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}
          {(sichtbar.length > 0 ? sichtbar : points).map((p, i) => {
            const barW = Math.max(12, w / n - 6)
            const x = i * (w / n) + 3
            const barH = peak > 0 ? (p.value / peak) * (h - 56) : 0
            const labelZeigen = p.label && (i % schritt === 0 || i === n - 1)
            return (
              <g key={`${p.label}-${i}`}>
                {p.highlight ? (
                  <rect x={x - 2} y={10} width={barW + 4} height={h - 20} rx={6} fill="rgba(255,255,255,0.04)" />
                ) : null}
                {werteAnzeigen && p.value > 0 ? (
                  <text x={x + barW / 2} y={18} textAnchor="middle" fill={color} fontSize="9" fontWeight="600">
                    {formatValue(p.value)}
                  </text>
                ) : null}
                <rect
                  x={x}
                  y={h - 28 - barH}
                  width={barW}
                  height={Math.max(barH, p.value > 0 ? 3 : 0)}
                  rx={3}
                  fill={color}
                />
                {labelZeigen ? (
                  <text x={x + barW / 2} y={h - 6} textAnchor="middle" fill="#71717a" fontSize="8">
                    {p.label}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
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
  const sichtbar = points.filter((p) => p.value > 0)
  const h = 160
  const w = chartBreite(sichtbar.length || points.length)
  const n = sichtbar.length
  const schritt = labelSchritt(n)
  const werteAnzeigen = n <= 10
  const vals = sichtbar.map((p) => p.value)
  const min = vals.length ? Math.min(...vals) * 0.92 : 0
  const max = vals.length ? Math.max(...vals) * 1.08 : 1
  const range = max - min || 1
  const padX = 16
  const chartW = w - padX * 2

  const coords = sichtbar.map((p, i) => {
    const x = padX + (i / Math.max(n - 1, 1)) * chartW
    const y = 24 + (1 - (p.value - min) / range) * (h - 52)
    return { x, y, ...p, i }
  })

  const poly = coords.map((c) => `${c.x},${c.y}`).join(' ')

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <WhoopChartHeader title={title} onInfo={onInfo} />
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          style={{ minWidth: w, width: '100%', height: h }}
          preserveAspectRatio="xMinYMid meet"
        >
          {coords.length >= 2 ? (
            <polyline points={poly} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          ) : null}
          {coords.map((c) => {
            const labelZeigen = c.label && (c.i % schritt === 0 || c.i === n - 1)
            return (
              <g key={`${c.label}-${c.i}`}>
                <circle cx={c.x} cy={c.y} r={3.5} fill={color} />
                {werteAnzeigen ? (
                  <text x={c.x} y={c.y - 10} textAnchor="middle" fill={color} fontSize="8">
                    {c.value}
                  </text>
                ) : null}
                {labelZeigen ? (
                  <text x={c.x} y={h - 6} textAnchor="middle" fill="#71717a" fontSize="8">
                    {c.label}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
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
