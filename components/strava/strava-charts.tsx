'use client'

import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type { SpeedTrendPoint, WeeklyVolumeBar, ZoneSlice } from '@/lib/strava/strava-dashboard-analytics'
import { SPORT_COLORS } from '@/lib/strava/strava-dashboard-analytics'
import { useMemo, useState } from 'react'

type VolumeChartProps = {
  data: WeeklyVolumeBar[]
}

export function StravaVolumeChart({ data }: VolumeChartProps) {
  const peak = useMemo(() => Math.max(...data.map((d) => d.totalKm), 1), [data])
  const h = 180
  const w = Math.max(480, data.length * 36)
  const n = data.length || 1

  return (
    <StravaCard padding="md">
      <StravaSectionTitle
        title="Volume & Consistency"
        subtitle="Wöchentliche Distanz · letzte 12 Wochen"
      />
      <div className="mb-3 flex flex-wrap gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SPORT_COLORS.ride }} />
          Ride
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SPORT_COLORS.run }} />
          Run
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SPORT_COLORS.other }} />
          Sonstige
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: w, width: '100%', height: h }} preserveAspectRatio="xMinYMid meet">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              y1={h - 32 - f * (h - 56)}
              x2={w}
              y2={h - 32 - f * (h - 56)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}
          {data.map((d, i) => {
            const barW = Math.max(14, w / n - 8)
            const x = i * (w / n) + 4
            const baseY = h - 32
            const totalH = peak > 0 ? (d.totalKm / peak) * (h - 56) : 0
            const segments = [
              { km: d.rideKm, color: SPORT_COLORS.ride },
              { km: d.runKm, color: SPORT_COLORS.run },
              { km: d.otherKm, color: SPORT_COLORS.other },
            ]
            let stackY = baseY
            return (
              <g key={d.weekStart}>
                {d.totalKm > 0 ? (
                  <text x={x + barW / 2} y={baseY - totalH - 4} textAnchor="middle" fill={STRAVA_COLORS.orange} fontSize="8" fontWeight="600">
                    {d.totalKm.toFixed(0)}
                  </text>
                ) : null}
                {[...segments].reverse().map((seg) => {
                  const segH = peak > 0 ? (seg.km / peak) * (h - 56) : 0
                  stackY -= segH
                  return (
                    <rect
                      key={seg.color}
                      x={x}
                      y={stackY}
                      width={barW}
                      height={Math.max(segH, seg.km > 0 ? 2 : 0)}
                      fill={seg.color}
                      rx={2}
                      className="transition-opacity duration-200 hover:opacity-90"
                    />
                  )
                })}
                <text x={x + barW / 2} y={h - 8} textAnchor="middle" fill="#71717a" fontSize="7">
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
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
              <span className="min-w-[72px] text-xs text-zinc-400">{z.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${z.pct}%`, background: z.color }}
                />
              </div>
              <span className="w-10 text-right text-[10px] tabular-nums text-zinc-500">{z.pct.toFixed(0)}%</span>
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const vals = points.map((p) => p.value).filter((v) => v > 0)
  const h = 180
  const w = Math.max(400, points.length * 40)
  const n = points.length
  const min = vals.length ? Math.min(...vals) * 0.88 : 0
  const max = vals.length ? Math.max(...vals) * 1.08 : 1
  const range = max - min || 1
  const padX = 20
  const chartW = w - padX * 2

  const coords = points.map((p, i) => {
    const x = padX + (i / Math.max(n - 1, 1)) * chartW
    const y = 28 + (1 - ((p.value || min) - min) / range) * (h - 60)
    return { x, y, i, ...p }
  })

  const smoothPath = useMemo(() => {
    if (coords.length < 2) return ''
    let d = `M ${coords[0].x} ${coords[0].y}`
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1]
      const cur = coords[i]
      const cpx = (prev.x + cur.x) / 2
      d += ` C ${cpx} ${prev.y}, ${cpx} ${cur.y}, ${cur.x} ${cur.y}`
    }
    return d
  }, [coords])

  const hover = hoverIdx != null ? coords[hoverIdx] : null

  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Fitness & Speed Trend" subtitle="Ø Tempo/Pace · Fahrten ≥20 min" />
      {points.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Noch nicht genug Daten für den Trend.</p>
      ) : (
        <>
          {hover ? (
            <div className="mb-3 rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2 text-xs">
              <p className="font-semibold text-zinc-100">{hover.name}</p>
              <p className="mt-1 text-zinc-400">
                {hover.valueLabel} · {hover.distanceLabel} · {hover.timeLabel} · HF {hover.hrLabel}
              </p>
            </div>
          ) : (
            <p className="mb-3 text-[11px] text-zinc-600">Hover über einen Punkt für Details</p>
          )}
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              style={{ minWidth: w, width: '100%', height: h }}
              preserveAspectRatio="xMinYMid meet"
            >
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1={padX}
                  y1={28 + (1 - f) * (h - 60)}
                  x2={w - padX}
                  y2={28 + (1 - f) * (h - 60)}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}
              {smoothPath ? (
                <path d={smoothPath} fill="none" stroke={STRAVA_COLORS.cyan} strokeWidth={2.5} strokeLinecap="round" />
              ) : null}
              {coords.map((c) => (
                <g key={c.activityId}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={hoverIdx === c.i ? 6 : 4}
                    fill={STRAVA_COLORS.cyan}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoverIdx(c.i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                  <text x={c.x} y={h - 8} textAnchor="middle" fill="#71717a" fontSize="7">
                    {c.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </StravaCard>
  )
}
