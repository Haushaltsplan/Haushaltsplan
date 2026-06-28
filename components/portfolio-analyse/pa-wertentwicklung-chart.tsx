'use client'

import { CHART, CHART_AXIS, CHART_GRID } from '@/lib/chart-theme'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lockAppScroll } from '@/lib/app-scroll-lock'
import { chartHoverFromClientX } from '@/components/portfolio-analyse/chart-hover'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'

const VIEW_W = 1000

type PlotPt = { x: number; yPortfolio: number; yKapital: number; p: WertentwicklungPunkt }

function stepPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i - 1].y.toFixed(1)} L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  return d
}

function formatYAxis(eur: number): string {
  const abs = Math.abs(eur)
  if (abs >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${Math.round(eur / 1000)}k`
  return String(Math.round(eur))
}

function IconExpand({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
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
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function WertentwicklungChartBody({
  punkte,
  hoehe,
  laden,
  gross,
}: {
  punkte: WertentwicklungPunkt[]
  hoehe: number
  laden: boolean
  gross: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [tooltipLeftPct, setTooltipLeftPct] = useState(50)
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
  const padRechts = 52
  const padOben = gross ? 28 : 24
  const padUnten = gross ? 48 : 44
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { plotPts, minY, maxY, yTicks, kapitalPath, portfolioPath } = useMemo(() => {
    if (punkte.length === 0) {
      return {
        plotPts: [] as PlotPt[],
        minY: 0,
        maxY: 1,
        yTicks: [0],
        kapitalPath: '',
        portfolioPath: '',
      }
    }
    const allY = punkte.flatMap((p) => [p.portfoliowertEur, p.zugefuehrtEur])
    const minV = 0
    const maxV = Math.max(1, ...allY) * 1.05
    const span = maxV - minV || 1
    const n = punkte.length

    const pts: PlotPt[] = punkte.map((p, i) => {
      const x = padLinks + (plotW * i) / Math.max(1, n - 1)
      const yPortfolio = padOben + plotH - ((p.portfoliowertEur - minV) / span) * plotH
      const yKapital = padOben + plotH - ((p.zugefuehrtEur - minV) / span) * plotH
      return { x, yPortfolio, yKapital, p }
    })

    const kapitalPts = pts.map((pt) => ({ x: pt.x, y: pt.yKapital }))
    const portPts = pts.map((pt) => ({ x: pt.x, y: pt.yPortfolio }))

    const tickCount = gross ? 5 : 4
    const ticks: number[] = []
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(minV + (span * i) / tickCount)
    }

    return {
      plotPts: pts,
      minY: minV,
      maxY: maxV,
      yTicks: ticks,
      kapitalPath: stepPath(kapitalPts),
      portfolioPath: portPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
    }
  }, [punkte, plotW, plotH, padLinks, padOben, gross])

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
  const differenz = active ? active.p.differenzEur : 0

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
          aria-label="Wertentwicklung: Portfoliowert und zugeführtes Kapital"
          className="pointer-events-none block w-full select-none"
        >
        {yTicks.map((tick) => {
          const span = maxY - minY || 1
          const y = padOben + plotH - ((tick - minY) / span) * plotH
          return (
            <g key={tick}>
              <line
                x1={padLinks}
                y1={y}
                x2={breite - padRechts}
                y2={y}
                stroke={CHART_GRID}
                strokeWidth={1}
              />
              <text
                x={breite - padRechts + 6}
                y={y + 3}
                textAnchor="start"
                className="fill-[var(--app-text-muted)]"
                style={{ fontSize: gross ? 11 : 10 }}
              >
                {formatYAxis(tick)}
              </text>
            </g>
          )
        })}

        <text
          x={breite - padRechts + 6}
          y={padOben - 8}
          className="fill-[var(--app-text-muted)]"
          style={{ fontSize: 9 }}
        >
          (EUR)
        </text>

        <path d={kapitalPath} fill="none" stroke={CHART.primary} strokeWidth={gross ? 2.5 : 2} opacity={0.75} />
        <path
          d={portfolioPath}
          fill="none"
          stroke={CHART.emerald}
          strokeWidth={gross ? 3 : 2.5}
          strokeLinejoin="round"
        />

        {active ? (
          <line
            x1={active.x}
            y1={padOben}
            x2={active.x}
            y2={padOben + plotH}
            stroke={CHART_AXIS}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : null}

        {plotPts.map((pt, i) =>
          pt.p.label ? (
            <text
              key={pt.p.datumIso}
              x={pt.x}
              y={hoehe - 10}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
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
          className="pointer-events-none absolute z-10 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-xs shadow-xl sm:min-w-[200px]"
          style={
            schmal
              ? { left: 8, right: 8, top: 8 }
              : {
                  left: `clamp(8px, ${tooltipLeftPct.toFixed(1)}%, calc(100% - 220px))`,
                  top: 8,
                }
          }
        >
          <p className="mb-2 font-medium text-[var(--app-text)]">{formatDatumDe(active.p.datumIso)}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[var(--app-text-muted)]">
                <span className="inline-block h-0.5 w-3 rounded bg-[var(--app-text-muted)]" />
                Portfoliowert
              </span>
              <span className="tabular-nums font-medium text-[var(--app-text)]">
                {formatEur(active.p.portfoliowertEur)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[var(--app-text-muted)]">
                <span className="inline-block h-0.5 w-3 rounded bg-[var(--app-surface-muted)]" />
                Zugeführtes Kapital
              </span>
              <span className="tabular-nums font-medium text-[var(--app-text)]">
                {formatEur(active.p.zugefuehrtEur)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-4 border-t border-[var(--app-border)] pt-1.5">
              <span className="text-[var(--app-text-muted)]">Differenz</span>
              <span
                className={`tabular-nums font-semibold ${
                  differenz >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {differenz >= 0 ? '+' : ''}
                {formatEur(differenz)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--app-text-muted)]">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 rounded bg-[var(--app-text-muted)]" />
          Portfoliowert
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 rounded bg-[var(--app-surface-muted)]" />
          Zugeführtes Kapital
        </span>
        {laden ? <span className="text-[var(--app-text-muted)]">· Tageskurse werden geladen …</span> : null}
      </div>
    </div>
  )
}

/** Parqet-ähnlich: Portfoliowert + zugeführtes Kapital; optional Vollbild per Expand-Icon. */
export function PaWertentwicklungChart({
  punkte,
  hoehe = 280,
  laden = false,
  expandierbar = true,
}: {
  punkte: WertentwicklungPunkt[]
  hoehe?: number
  laden?: boolean
  expandierbar?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedHoehe, setExpandedHoehe] = useState(520)

  useEffect(() => {
    if (!expanded) return
    const update = () => {
      setExpandedHoehe(Math.max(400, Math.min(640, Math.round(window.innerHeight * 0.72))))
    }
    update()
    window.addEventListener('resize', update)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    const unlock = lockAppScroll()
    return () => {
      window.removeEventListener('resize', update)
      document.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [expanded])

  if (punkte.length < 2) {
    return <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Noch zu wenig Historie für die Wertentwicklung.</p>
  }

  return (
    <>
      <div className="app-chart-frame relative min-w-0 p-4 pr-10 sm:p-5">
        {expandierbar ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute right-0 top-0 z-20 rounded-lg p-2 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-hover)]/70 hover:text-[var(--app-text)]"
            aria-label="Chart vergrößern"
            title="Vergrößern"
          >
            <IconExpand className="h-5 w-5" />
          </button>
        ) : null}
        <WertentwicklungChartBody punkte={punkte} hoehe={hoehe} laden={laden} gross={false} />
      </div>

      {expanded ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpanded(false)
          }}
        >
          <div
            className="app-surface-card app-scroll-panel relative flex max-h-[min(94vh,760px)] w-full max-w-6xl flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Wertentwicklung – vergrößert"
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute right-3 top-3 z-30 rounded-lg p-2 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
              aria-label="Schließen"
              title="Schließen"
            >
              <IconClose className="h-5 w-5" />
            </button>

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-12 sm:px-6 sm:pb-6">
              <WertentwicklungChartBody
                punkte={punkte}
                hoehe={expandedHoehe}
                laden={laden}
                gross
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
