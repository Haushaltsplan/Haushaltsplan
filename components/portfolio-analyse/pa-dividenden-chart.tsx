'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chartHoverFromClientX } from '@/components/portfolio-analyse/chart-hover'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { GestapelterDivMonat } from '@/lib/portfolio-analyse/dividenden-auswertung'

const MIN_BREITE = 1000

export function PaGestapelteDividendenChart({
  daten,
  durchschnittIntervallEur = 0,
  hoehe = 220,
}: {
  daten: GestapelterDivMonat[]
  durchschnittIntervallEur?: number
  hoehe?: number
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastClientX = useRef<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [tooltipX, setTooltipX] = useState(0)
  const [outerWidth, setOuterWidth] = useState(0)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setOuterWidth(el.clientWidth))
    ro.observe(el)
    setOuterWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const breite = Math.max(MIN_BREITE, 56 + daten.length * 14)
  const padLinks = 48
  const padRechts = 16
  const padOben = 24
  const padUnten = 36
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  type BarRow = {
    x: number
    cx: number
    label: string
    segs: { x: number; y: number; w: number; h: number; key: string; label: string; wert: number; farbe: string }[]
    gesamt: number
    ttm: number | null
    ttmY: number | null
  }

  const { bars, yMax, ttmPath, intervallY } = useMemo(() => {
    if (daten.length === 0) {
      return { bars: [] as BarRow[], yMax: 1, ttmPath: '', intervallY: null as number | null }
    }

    const yMax =
      Math.max(1, ...daten.map((d) => Math.max(d.gesamt, d.ttmMonatlichEur ?? 0)), durchschnittIntervallEur) *
      1.08
    const baseY = padOben + plotH
    const n = daten.length
    const barW = Math.max(3, Math.min(10, (plotW / n) * 0.72))

    const bars = daten.map((d, i) => {
      const x = padLinks + (plotW * (i + 0.5)) / n - barW / 2
      let yAcc = baseY
      const segs = d.segmente.map((s) => {
        const h = (s.wert / yMax) * plotH
        yAcc -= h
        return { x, y: yAcc, w: barW, h, ...s }
      })
      const cx = x + barW / 2
      const ttmY =
        d.ttmMonatlichEur != null && d.ttmMonatlichEur > 0
          ? padOben + plotH - (d.ttmMonatlichEur / yMax) * plotH
          : null
      return { x, cx, label: d.label, segs, gesamt: d.gesamt, ttm: d.ttmMonatlichEur, ttmY }
    })

    const ttmPts = bars.filter((b): b is typeof b & { ttmY: number } => b.ttmY != null)
    let ttmPath = ''
    if (ttmPts.length >= 2) {
      ttmPath = ttmPts
        .map((b, i) => `${i === 0 ? 'M' : 'L'} ${b.cx.toFixed(1)} ${b.ttmY!.toFixed(1)}`)
        .join(' ')
    }

    const intervallY =
      durchschnittIntervallEur > 0
        ? padOben + plotH - (durchschnittIntervallEur / yMax) * plotH
        : null

    return { bars, yMax, ttmPath, intervallY }
  }, [daten, plotH, plotW, padLinks, padOben, durchschnittIntervallEur])

  const pickIndex = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el || bars.length === 0) return
      const rect = el.getBoundingClientRect()
      const hit = chartHoverFromClientX(
        clientX,
        rect,
        breite,
        hoehe,
        padLinks,
        padRechts,
        bars.length,
        { align: 'start', scrollLeft: el.scrollLeft },
      )
      if (!hit) return
      const bar = bars[hit.index]
      const sichtbarX = hit.offsetX + bar.cx * hit.scale - el.scrollLeft
      setHoverIndex(hit.index)
      setTooltipX(sichtbarX)
    },
    [bars, breite, hoehe, padLinks, padRechts],
  )

  const labelStep = Math.max(1, Math.ceil(daten.length / 14))
  const active = hoverIndex != null && bars.length > 0 ? bars[hoverIndex] : null
  const activeDaten = hoverIndex != null ? daten[hoverIndex] : null
  const tooltipLeft = useMemo(() => {
    const half = 150
    if (outerWidth <= 0) return tooltipX
    return Math.min(outerWidth - half, Math.max(half, tooltipX))
  }, [outerWidth, tooltipX])

  if (daten.length < 2) {
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Dividenden-Daten.</p>
  }

  const tooltipExtraPad =
    activeDaten != null ? Math.min(480, 64 + activeDaten.segmente.length * 28) : 0

  return (
    <div
      ref={outerRef}
      className="relative w-full min-w-0"
      style={{ paddingBottom: tooltipExtraPad }}
    >
      <div
        ref={containerRef}
        className="relative w-full cursor-crosshair overflow-x-auto"
        style={{ height: hoehe }}
        onMouseMove={(e) => {
          lastClientX.current = e.clientX
          pickIndex(e.clientX)
        }}
        onScroll={() => {
          if (lastClientX.current != null) pickIndex(lastClientX.current)
        }}
        onMouseLeave={() => {
          lastClientX.current = null
          setHoverIndex(null)
        }}
        onTouchMove={(e) => {
          const t = e.touches[0]
          if (t) pickIndex(t.clientX)
        }}
        onTouchEnd={() => setHoverIndex(null)}
      >
        <svg
          width={breite}
          height={hoehe}
          viewBox={`0 0 ${breite} ${hoehe}`}
          preserveAspectRatio="xMinYMid meet"
          role="img"
          aria-label="Dividenden pro Monat mit TTM-Trend"
          className="pointer-events-none block min-w-full select-none"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padOben + plotH * (1 - f)
            const tick = yMax * f
            return (
              <g key={f}>
                <line
                  x1={padLinks}
                  y1={y}
                  x2={breite - padRechts}
                  y2={y}
                  stroke="#27272a"
                  strokeWidth={1}
                />
                <text x={padLinks - 4} y={y + 3} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
                  {formatEur(tick)}
                </text>
              </g>
            )
          })}

          {intervallY != null ? (
            <line
              x1={padLinks}
              y1={intervallY}
              x2={breite - padRechts}
              y2={intervallY}
              stroke="#71717a"
              strokeWidth={1}
              strokeDasharray="5 4"
            />
          ) : null}

          {bars.map((b, i) => (
            <g key={i}>
              {b.segs.map((s) => (
                <rect key={s.key} x={s.x} y={s.y} width={s.w} height={Math.max(1, s.h)} fill={s.farbe} />
              ))}
              {i % labelStep === 0 || i === bars.length - 1 ? (
                <text
                  x={b.cx}
                  y={hoehe - 8}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  style={{ fontSize: 8 }}
                >
                  {b.label}
                </text>
              ) : null}
            </g>
          ))}

          {ttmPath ? (
            <path
              d={ttmPath}
              fill="none"
              stroke="#d4d4d8"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {active ? (
            <line
              x1={active.cx}
              y1={padOben}
              x2={active.cx}
              y2={padOben + plotH}
              stroke="#a1a1aa"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}
        </svg>
      </div>

      {active && activeDaten ? (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-[min(100%,320px)] rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2.5 text-xs shadow-xl sm:min-w-[260px]"
          style={{
            left: tooltipLeft,
            top: hoehe + 6,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-zinc-800 pb-2">
            <span className="font-medium text-zinc-200">{activeDaten.tooltipTitel}</span>
            <span className="tabular-nums font-semibold text-zinc-100">{formatEur(active.gesamt)}</span>
          </div>
          <div className="space-y-1.5">
            {durchschnittIntervallEur > 0 ? (
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Ø Dividende im Intervall</span>
                <span className="tabular-nums text-zinc-300">{formatEur(durchschnittIntervallEur)}</span>
              </div>
            ) : null}
            {active.ttm != null ? (
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Ø monatl. Einkommen (TTM)</span>
                <span className="tabular-nums text-zinc-300">{formatEur(active.ttm)}</span>
              </div>
            ) : null}
          </div>
          {activeDaten.segmente.length > 0 ? (
            <ul className="mt-2 space-y-1.5 border-t border-zinc-800 pt-2">
              {activeDaten.segmente.map((s) => (
                <li key={s.key} className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-zinc-400">
                    <span
                      className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: s.farbe }}
                    />
                    <span className="leading-snug break-words">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-200">{formatEur(s.wert)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
        {ttmPath ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-zinc-300" />
            Ø monatl. Einkommen (TTM)
          </span>
        ) : null}
        {durchschnittIntervallEur > 0 ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 border-t border-dashed border-zinc-500" />
            Ø Dividende im Intervall
          </span>
        ) : null}
      </div>
    </div>
  )
}
