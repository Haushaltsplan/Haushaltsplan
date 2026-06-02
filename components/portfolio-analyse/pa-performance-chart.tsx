'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { chartHoverFromClientX } from '@/components/portfolio-analyse/chart-hover'
import { formatDatumDe, formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type { PerformanceZeitPunkt } from '@/lib/portfolio-analyse/performance-zeitreihe'

const VIEW_W = 1000

type PlotPt = { x: number; y: number; p: PerformanceZeitPunkt }

function ySkala(punkte: PerformanceZeitPunkt[]): { yMin: number; yMax: number } {
  const vals = punkte.map((p) => p.performanceProzent)
  const minV = Math.min(0, ...vals)
  const maxV = Math.max(0, ...vals)
  const yMin = Math.floor(Math.min(minV, -10) / 10) * 10
  const yMax = Math.ceil(Math.max(maxV, 10) / 10) * 10
  return { yMin: yMin === yMax ? -10 : yMin, yMax: yMax === yMin ? 10 : yMax }
}

function areaZuNullLinie(pts: PlotPt[], zeroY: number): string {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)}`
  d += ` L ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`
  return d
}

function IconExpand({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
      />
    </svg>
  )
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function PerformanceChartBody({
  punkte,
  portfolioName,
  hoehe,
  gross,
}: {
  punkte: PerformanceZeitPunkt[]
  portfolioName: string
  hoehe: number
  gross: boolean
}) {
  const clipPosId = useId()
  const clipNegId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [schmal, setSchmal] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setSchmal(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const breite = VIEW_W
  const padLinks = 12
  const padRechts = 48
  const padOben = gross ? 28 : 24
  const padUnten = gross ? 48 : 44
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { plotPts, zeroY, yTicks, areaPath, linePath } = useMemo(() => {
    if (punkte.length === 0) {
      return { plotPts: [] as PlotPt[], zeroY: 0, yTicks: [0], areaPath: '', linePath: '' }
    }

    const { yMin, yMax } = ySkala(punkte)
    const span = yMax - yMin || 1
    const n = punkte.length

    const pts: PlotPt[] = punkte.map((p, i) => {
      const x = padLinks + (plotW * i) / Math.max(1, n - 1)
      const y = padOben + ((yMax - p.performanceProzent) / span) * plotH
      return { x, y, p }
    })

    const zeroY = padOben + ((yMax - 0) / span) * plotH

    const ticks: number[] = []
    const step = span <= 30 ? 10 : span <= 60 ? 10 : 20
    for (let t = yMin; t <= yMax; t += step) ticks.push(t)
    if (!ticks.includes(0)) ticks.push(0)
    ticks.sort((a, b) => b - a)

    const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')

    return {
      plotPts: pts,
      zeroY,
      yTicks: ticks,
      areaPath: areaZuNullLinie(pts, zeroY),
      linePath: line,
    }
  }, [punkte, plotW, plotH, padLinks, padOben])

  const [tooltipLeftPct, setTooltipLeftPct] = useState(50)

  const pickIndex = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el || plotPts.length === 0) return
      const rect = el.getBoundingClientRect()
      const hit = chartHoverFromClientX(
        clientX,
        rect,
        breite,
        hoehe,
        padLinks,
        padRechts,
        plotPts.length,
      )
      if (!hit) return
      setHoverIndex(hit.index)
      setTooltipLeftPct(hit.tooltipLeftPct)
    },
    [breite, hoehe, padLinks, padRechts, plotPts.length],
  )

  const active = hoverIndex != null ? plotPts[hoverIndex] : null

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
          aria-label="Performance in Prozent"
          className="pointer-events-none block w-full select-none"
        >
          <defs>
            <clipPath id={clipPosId}>
              <rect x={padLinks} y={padOben} width={plotW} height={Math.max(0, zeroY - padOben)} />
            </clipPath>
            <clipPath id={clipNegId}>
              <rect x={padLinks} y={zeroY} width={plotW} height={Math.max(0, padOben + plotH - zeroY)} />
            </clipPath>
          </defs>

          {yTicks.map((tick) => {
            const { yMin, yMax } = ySkala(punkte)
            const span = yMax - yMin || 1
            const y = padOben + ((yMax - tick) / span) * plotH
            return (
              <g key={tick}>
                <line
                  x1={padLinks}
                  y1={y}
                  x2={breite - padRechts}
                  y2={y}
                  stroke={tick === 0 ? '#52525b' : '#27272a'}
                  strokeWidth={tick === 0 ? 1.25 : 1}
                />
                <text
                  x={breite - padRechts + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-zinc-500"
                  style={{ fontSize: gross ? 11 : 10 }}
                >
                  {tick > 0 ? '+' : ''}
                  {tick}%
                </text>
              </g>
            )
          })}

          <path d={areaPath} fill="#34d399" fillOpacity={0.45} clipPath={`url(#${clipPosId})`} />
          <path d={areaPath} fill="#f87171" fillOpacity={0.5} clipPath={`url(#${clipNegId})`} />
          <path d={linePath} fill="none" stroke="#a1a1aa" strokeWidth={gross ? 2 : 1.5} strokeLinejoin="round" />

          {active ? (
            <line
              x1={active.x}
              y1={padOben}
              x2={active.x}
              y2={padOben + plotH}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
          ) : null}

          {plotPts.map((pt) =>
            pt.p.label ? (
              <text
                key={pt.p.datumIso}
                x={pt.x}
                y={hoehe - 10}
                textAnchor="middle"
                className="fill-zinc-500"
                style={{ fontSize: gross ? 10 : 9 }}
              >
                {pt.p.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      {active ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2.5 text-xs shadow-xl sm:min-w-[200px]"
          style={
            schmal
              ? { left: 8, right: 8, top: 8 }
              : {
                  left: `clamp(8px, ${tooltipLeftPct.toFixed(1)}%, calc(100% - 220px))`,
                  top: 8,
                }
          }
        >
          <p className="mb-2 font-medium text-zinc-200">
            {formatDatumDe(active.p.datumIso)} (Tagesende)
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="inline-block h-2 w-2 rounded-full bg-zinc-300" />
              {portfolioName}
            </span>
            <span
              className={`tabular-nums font-semibold ${
                active.p.performanceProzent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {active.p.performanceProzent >= 0 ? '' : ''}
              {formatProzent(active.p.performanceProzent)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PaPerformanceChart({
  punkte,
  portfolioName = 'Portfolio',
  hoehe = 280,
  laden = false,
  mitDivRealisiert,
  onMitDivRealisiertChange,
  expandierbar = true,
}: {
  punkte: PerformanceZeitPunkt[]
  portfolioName?: string
  hoehe?: number
  laden?: boolean
  mitDivRealisiert: boolean
  onMitDivRealisiertChange: (v: boolean) => void
  expandierbar?: boolean
}) {
  const [vollbild, setVollbild] = useState(false)

  if (punkte.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        Noch zu wenig Historie für die Performance-Kurve.
      </p>
    )
  }

  const toolbar = (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-400">
        <button
          type="button"
          role="switch"
          aria-checked={mitDivRealisiert}
          onClick={() => onMitDivRealisiertChange(!mitDivRealisiert)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            mitDivRealisiert ? 'bg-teal-600' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              mitDivRealisiert ? 'translate-x-5' : ''
            }`}
          />
        </button>
        Dividenden und realisierte Gewinne inkludieren
      </label>
      <select
        className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-teal-500/40"
        defaultValue="rendite"
        aria-label="Performance-Ansicht"
      >
        <option value="rendite">Rendite</option>
      </select>
    </div>
  )

  const body = (
    <>
      {toolbar}
      <PerformanceChartBody punkte={punkte} portfolioName={portfolioName} hoehe={hoehe} gross={vollbild} />
      {laden ? (
        <p className="mt-2 text-center text-[11px] text-zinc-600">Tageskurse werden geladen …</p>
      ) : null}
    </>
  )

  return (
    <div className="relative">
      {body}
      {expandierbar ? (
        <button
          type="button"
          onClick={() => setVollbild(true)}
          className="absolute right-0 bottom-0 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
          aria-label="Chart vergrößern"
        >
          <IconExpand className="h-5 w-5" />
        </button>
      ) : null}

      {vollbild ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Performance Vollbild"
        >
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setVollbild(false)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              aria-label="Schließen"
            >
              <IconClose className="h-6 w-6" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <PerformanceChartBody
              punkte={punkte}
              portfolioName={portfolioName}
              hoehe={Math.min(560, typeof window !== 'undefined' ? window.innerHeight - 160 : 560)}
              gross
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
