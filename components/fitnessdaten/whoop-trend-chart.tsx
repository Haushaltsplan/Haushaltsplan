'use client'

import { appTableScrollInlineClassName } from '@/components/page-shell'
import { useCallback, useMemo, useRef, useState } from 'react'

export type WhoopTrendPoint = {
  date: string
  label: string
  value: number
}

type Props = {
  title: string
  unit: string
  points: WhoopTrendPoint[]
  monthlyAvg: number | null
  variant: 'line' | 'bar'
  formatValue?: (v: number) => string
  insight?: string | null
}

function fmtDe(v: number, decimals = 0): string {
  if (decimals > 0) return v.toFixed(decimals).replace('.', ',')
  return Math.round(v).toLocaleString('de-DE')
}

export function WhoopTrendChart({
  title,
  unit,
  points,
  monthlyAvg,
  variant,
  formatValue = (v) => fmtDe(v),
  insight,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, points.length - 1))

  const sichtbar = useMemo(() => points.filter((p) => p.value > 0), [points])
  const daten = sichtbar.length > 0 ? sichtbar : points
  const idx = Math.min(activeIdx, Math.max(0, daten.length - 1))
  const aktiv = daten[idx]

  const peak = useMemo(() => {
    const vals = daten.map((p) => p.value).filter((v) => v > 0)
    if (vals.length === 0) return 1
    return Math.max(...vals) * 1.12
  }, [daten])

  const avg = monthlyAvg ?? (daten.length > 0
    ? Math.round(daten.reduce((a, p) => a + p.value, 0) / daten.length)
    : null)

  const w = Math.max(340, daten.length * 14)
  const h = 200
  const padL = 44
  const padR = 12
  const padT = 16
  const padB = 28
  const chartW = w - padL - padR
  const chartH = h - padT - padB

  const coords = useMemo(
    () =>
      daten.map((p, i) => ({
        ...p,
        i,
        x: padL + (i / Math.max(daten.length - 1, 1)) * chartW,
        y: padT + chartH - (p.value / peak) * chartH,
      })),
    [daten, chartW, chartH, peak, padL, padT],
  )

  const avgY = avg != null && avg > 0 ? padT + chartH - (avg / peak) * chartH : null

  const yTicks = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => (peak / steps) * i)
  }, [peak])

  const xLabelSchritt = daten.length <= 10 ? 1 : daten.length <= 30 ? 5 : 14

  const scrub = useCallback(
    (clientX: number) => {
      const svg = svgRef.current
      if (!svg || coords.length === 0) return
      const rect = svg.getBoundingClientRect()
      const rel = (clientX - rect.left) / rect.width
      const xInView = rel * w
      let best = 0
      let bestDist = Infinity
      for (const c of coords) {
        const d = Math.abs(c.x - xInView)
        if (d < bestDist) {
          bestDist = d
          best = c.i
        }
      }
      setActiveIdx(best)
    },
    [coords, w],
  )

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    scrub(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const trendPct =
    avg != null && avg > 0 && aktiv
      ? Math.round(((aktiv.value - avg) / avg) * 100)
      : null

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0f1012] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">{title}</p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Durchschnitt</p>
          <p className="text-3xl font-bold tabular-nums text-white">
            {aktiv ? formatValue(aktiv.value) : '—'}
            {unit ? <span className="ml-1 text-sm font-medium text-[var(--app-text-muted)]">{unit}</span> : null}
          </p>
          {trendPct != null ? (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                trendPct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {trendPct >= 0 ? '▲' : '▼'} {Math.abs(trendPct)}% vs. Monats-Ø
            </span>
          ) : null}
          {aktiv?.label ? (
            <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">{aktiv.label}</p>
          ) : null}
        </div>
        {avg != null ? (
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase text-[var(--app-text-muted)]">Monats-Ø</p>
            <p className="text-sm font-bold tabular-nums text-[var(--app-text-muted)]">
              {formatValue(avg)}
            </p>
          </div>
        ) : null}
      </div>

      {insight ? <p className="mt-3 text-xs leading-relaxed text-[var(--app-text-muted)]">{insight}</p> : null}

      <div className={`mt-4 ${appTableScrollInlineClassName}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          style={{ minWidth: w, width: '100%', height: h }}
          className="touch-none select-none"
          onPointerDown={onPointer}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') scrub(e.clientX)
          }}
        >
          {yTicks.map((v) => {
            const y = padT + chartH - (v / peak) * chartH
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={padL - 6} y={y + 3} textAnchor="end" fill="#52525b" fontSize="8">
                  {fmtDe(v)}
                </text>
              </g>
            )
          })}

          {avgY != null ? (
            <>
              <line
                x1={padL}
                y1={avgY}
                x2={w - padR}
                y2={avgY}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <rect x={padL} y={avgY - 8} width={52} height={14} rx={3} fill="white" />
              <text x={padL + 4} y={avgY + 2} fill="#111" fontSize="7" fontWeight="700">
                DURCHSCHN.
              </text>
            </>
          ) : null}

          {variant === 'bar'
            ? coords.map((c) => {
                const barW = Math.max(6, chartW / daten.length - 4)
                const barH = (c.value / peak) * chartH
                const active = c.i === idx
                return (
                  <g key={`${c.date}-${c.i}`}>
                    <rect
                      x={c.x - barW / 2}
                      y={padT + chartH - barH}
                      width={barW}
                      height={Math.max(barH, c.value > 0 ? 2 : 0)}
                      rx={2}
                      fill={active ? '#00b4ff' : '#009dff'}
                      opacity={active ? 1 : 0.65}
                    />
                  </g>
                )
              })
            : coords.length >= 2 ? (
                <polyline
                  points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
                  fill="none"
                  stroke="#009dff"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              ) : null}

          {variant === 'line'
            ? coords.map((c) => {
                const active = c.i === idx
                return (
                  <g key={`${c.date}-${c.i}`}>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={active ? 5 : 3}
                      fill={active ? '#00b4ff' : '#009dff'}
                      stroke={active ? '#fff' : 'none'}
                      strokeWidth={2}
                    />
                    {active ? (
                      <text x={c.x + 8} y={c.y - 6} fill="#00b4ff" fontSize="11" fontWeight="700">
                        {formatValue(c.value)}
                      </text>
                    ) : null}
                  </g>
                )
              })
            : null}

          {coords.map((c) =>
            c.label && (c.i % xLabelSchritt === 0 || c.i === daten.length - 1) ? (
              <text key={`lbl-${c.i}`} x={c.x} y={h - 6} textAnchor="middle" fill="#52525b" fontSize="8">
                {c.label}
              </text>
            ) : null,
          )}

          {coords[idx] ? (
            <line
              x1={coords[idx].x}
              y1={padT}
              x2={coords[idx].x}
              y2={padT + chartH}
              stroke="rgba(0,157,255,0.35)"
              strokeWidth={1}
            />
          ) : null}
        </svg>
      </div>

      <p className="mt-2 text-center text-[10px] text-[var(--app-text-muted)]">
        Wische über die Grafik, um frühere Tage zu sehen
      </p>
    </div>
  )
}
