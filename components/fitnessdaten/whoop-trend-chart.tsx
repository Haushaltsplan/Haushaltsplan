'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  const wrapRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, points.length - 1))
  const [svgW, setSvgW] = useState(360)

  const daten = points
  const idx = Math.min(activeIdx, Math.max(0, daten.length - 1))
  const aktiv = daten[idx]

  useEffect(() => {
    setActiveIdx(Math.max(0, points.length - 1))
  }, [points.length, points[0]?.date, points[points.length - 1]?.date])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSvgW(Math.max(280, Math.floor(el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const peak = useMemo(() => {
    const vals = daten.map((p) => p.value).filter((v) => v > 0)
    if (vals.length === 0) return 1
    return Math.max(...vals) * 1.15
  }, [daten])

  const avg =
    monthlyAvg ??
    (daten.length > 0
      ? Math.round(daten.reduce((a, p) => a + p.value, 0) / Math.max(1, daten.filter((d) => d.value > 0).length))
      : null)

  const h = 240
  const padL = 52
  const padR = 16
  const padT = 20
  const padB = 36
  const chartW = svgW - padL - padR
  const chartH = h - padT - padB

  const coords = useMemo(
    () =>
      daten.map((p, i) => ({
        ...p,
        i,
        x:
          daten.length <= 1
            ? padL + chartW / 2
            : padL + (i / (daten.length - 1)) * chartW,
        y: padT + chartH - (p.value / peak) * chartH,
      })),
    [daten, chartW, chartH, peak, padL, padT],
  )

  const avgY = avg != null && avg > 0 ? padT + chartH - (avg / peak) * chartH : null

  const yTicks = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => (peak / steps) * i)
  }, [peak])

  const xLabelSchritt = daten.length <= 8 ? 1 : daten.length <= 16 ? 2 : daten.length <= 35 ? 5 : 14

  const scrub = useCallback(
    (clientX: number) => {
      const svg = svgRef.current
      if (!svg || coords.length === 0) return
      const rect = svg.getBoundingClientRect()
      const rel = (clientX - rect.left) / Math.max(rect.width, 1)
      const xInView = rel * svgW
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
    [coords, svgW],
  )

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    scrub(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const trendPct =
    avg != null && avg > 0 && aktiv && aktiv.value > 0
      ? Math.round(((aktiv.value - avg) / avg) * 100)
      : null

  const barW = Math.max(
    8,
    Math.min(28, chartW / Math.max(daten.length, 1) - (daten.length <= 8 ? 10 : 4)),
  )

  return (
    <div className="overflow-visible rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 overflow-visible">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
            {aktiv?.label || title}
          </p>
          <p className="mt-1.5 text-[2rem] font-bold leading-none tracking-tight tabular-nums text-white sm:text-[2.35rem]">
            {aktiv && aktiv.value > 0 ? formatValue(aktiv.value) : '—'}
            {unit ? (
              <span className="ml-1.5 text-base font-medium text-[var(--app-text-muted)] sm:text-lg">
                {unit}
              </span>
            ) : null}
          </p>
          {trendPct != null ? (
            <span
              className={`mt-2.5 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                trendPct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {trendPct >= 0 ? '▲' : '▼'} {Math.abs(trendPct)}% vs. Monats-Ø
            </span>
          ) : null}
        </div>
        {avg != null ? (
          <div className="shrink-0 pt-0.5 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
              Monats-Ø
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-white/80">{formatValue(avg)}</p>
          </div>
        ) : null}
      </div>

      {insight ? (
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--app-text-muted)]">{insight}</p>
      ) : null}

      <div ref={wrapRef} className="mt-5 w-full overflow-visible">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgW} ${h}`}
          width="100%"
          height={h}
          className="touch-none select-none overflow-visible"
          onPointerDown={onPointer}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') scrub(e.clientX)
          }}
        >
          {yTicks.map((v) => {
            const y = padT + chartH - (v / peak) * chartH
            return (
              <g key={v}>
                <line
                  x1={padL}
                  y1={y}
                  x2={svgW - padR}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#71717a"
                  fontSize="11"
                  fontFamily="system-ui, sans-serif"
                >
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
                x2={svgW - padR}
                y2={avgY}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1.25}
                strokeDasharray="5 4"
              />
              {/* Label rechts, damit es Balken links nicht überdeckt / abschneidet */}
              <rect
                x={svgW - padR - 78}
                y={avgY - 10}
                width={72}
                height={18}
                rx={4}
                fill="rgba(255,255,255,0.92)"
              />
              <text
                x={svgW - padR - 42}
                y={avgY + 3}
                textAnchor="middle"
                fill="#111"
                fontSize="9"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                DURCHSCHN.
              </text>
            </>
          ) : null}

          {variant === 'bar'
            ? coords.map((c) => {
                const barH = (c.value / peak) * chartH
                const active = c.i === idx
                return (
                  <g key={`${c.date}-${c.i}`}>
                    <rect
                      x={c.x - barW / 2}
                      y={padT + chartH - barH}
                      width={barW}
                      height={Math.max(barH, c.value > 0 ? 3 : 0)}
                      rx={3}
                      fill={active ? '#3dc4ff' : '#009dff'}
                      opacity={active ? 1 : 0.55}
                    />
                  </g>
                )
              })
            : coords.length >= 2 ? (
                <polyline
                  points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
                  fill="none"
                  stroke="#009dff"
                  strokeWidth="2.75"
                  strokeLinejoin="round"
                  strokeLinecap="round"
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
                      r={active ? 6 : 3.5}
                      fill={active ? '#3dc4ff' : '#009dff'}
                      stroke={active ? '#fff' : 'none'}
                      strokeWidth={2}
                    />
                  </g>
                )
              })
            : null}

          {coords.map((c) =>
            c.label && (c.i % xLabelSchritt === 0 || c.i === daten.length - 1) ? (
              <text
                key={`lbl-${c.i}`}
                x={c.x}
                y={h - 10}
                textAnchor="middle"
                fill={c.i === idx ? '#a1a1aa' : '#52525b'}
                fontSize="11"
                fontWeight={c.i === idx ? 600 : 400}
                fontFamily="system-ui, sans-serif"
              >
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
              stroke="rgba(61,196,255,0.35)"
              strokeWidth={1.5}
            />
          ) : null}
        </svg>
      </div>

      <p className="mt-3 text-center text-[11px] text-[var(--app-text-muted)]">
        Wische über die Grafik, um Tage zu wählen
      </p>
    </div>
  )
}
