'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { chartHoverFromClientX } from '@/components/portfolio-analyse/chart-hover'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { GestapelterDivMonat } from '@/lib/portfolio-analyse/dividenden-auswertung'

const VIEW_W = 1000

export function PaGestapelteDividendenChart({
  daten,
  hoehe = 220,
}: {
  daten: GestapelterDivMonat[]
  hoehe?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [tooltipLeftPct, setTooltipLeftPct] = useState(50)

  const breite = VIEW_W
  const padLinks = 48
  const padRechts = 16
  const padOben = 24
  const padUnten = 32
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

  const { bars, yMax, ttmPath } = useMemo(() => {
    if (daten.length === 0) {
      return { bars: [] as BarRow[], yMax: 1, ttmPath: '' }
    }

    const yMax = Math.max(1, ...daten.map((d) => Math.max(d.gesamt, d.ttmMonatlichEur ?? 0))) * 1.1
    const baseY = padOben + plotH
    const n = daten.length
    const barW = Math.max(6, (plotW / n) * 0.7)

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

    return { bars, yMax, ttmPath }
  }, [daten, plotH, plotW, padLinks, padOben])

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
      )
      if (!hit) return
      setHoverIndex(hit.index)
      setTooltipLeftPct(hit.tooltipLeftPct)
    },
    [bars.length, breite, hoehe, padLinks, padRechts],
  )

  if (daten.length < 2) {
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Dividenden-Daten.</p>
  }

  const labelStep = Math.max(1, Math.ceil(daten.length / 10))
  const active = hoverIndex != null ? bars[hoverIndex] : null
  const activeDaten = hoverIndex != null ? daten[hoverIndex] : null

  return (
    <div className="relative w-full min-w-0">
      <div
        ref={containerRef}
        className="relative w-full cursor-crosshair"
        style={{ height: hoehe }}
        onMouseMove={(e) => pickIndex(e.clientX)}
        onMouseLeave={() => setHoverIndex(null)}
        onTouchMove={(e) => {
          const t = e.touches[0]
          if (t) pickIndex(t.clientX)
        }}
        onTouchEnd={() => setHoverIndex(null)}
      >
        <svg
          width="100%"
          height={hoehe}
          viewBox={`0 0 ${breite} ${hoehe}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Dividenden pro Monat mit TTM-Trend"
          className="pointer-events-none block w-full select-none"
        >
          <line
            x1={padLinks}
            y1={padOben + plotH}
            x2={breite - padRechts}
            y2={padOben + plotH}
            stroke="#27272a"
            strokeWidth={1}
          />
          <text x={padLinks - 4} y={padOben + 4} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
            {formatEur(yMax)}
          </text>

          {bars.map((b, i) => (
            <g key={i}>
              {b.segs.map((s) => (
                <rect key={s.key} x={s.x} y={s.y} width={s.w} height={Math.max(1, s.h)} fill={s.farbe} />
              ))}
              {i % labelStep === 0 ? (
                <text
                  x={b.cx}
                  y={hoehe - 6}
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
              stroke="#e4e4e7"
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
          className="pointer-events-none absolute z-10 rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2.5 text-xs shadow-xl sm:min-w-[200px]"
          style={{
            left: `clamp(8px, ${tooltipLeftPct.toFixed(1)}%, calc(100% - 240px))`,
            top: 8,
          }}
        >
          <p className="mb-2 font-medium text-zinc-200">{activeDaten.label}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Gesamt</span>
              <span className="tabular-nums font-medium text-zinc-100">{formatEur(active.gesamt)}</span>
            </div>
            {active.ttm != null ? (
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">TTM (Ø/Monat)</span>
                <span className="tabular-nums font-medium text-zinc-300">{formatEur(active.ttm)}</span>
              </div>
            ) : null}
            {activeDaten.segmente.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
                {activeDaten.segmente.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.farbe }} />
                      {s.label}
                    </span>
                    <span className="tabular-nums text-zinc-200">{formatEur(s.wert)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {ttmPath ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="inline-block h-0.5 w-6 bg-zinc-300" />
          TTM (gleitender Ø der letzten bis zu 12 Monate)
        </p>
      ) : null}
    </div>
  )
}
