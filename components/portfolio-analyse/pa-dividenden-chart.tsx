'use client'

import { appTableScrollInlineClassName } from '@/components/page-shell'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chartHoverFromClientX } from '@/components/portfolio-analyse/chart-hover'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { GestapelterDivMonat } from '@/lib/portfolio-analyse/dividenden-auswertung'

const MIN_BREITE = 1000

export function PaGestapelteDividendenChart({
  daten,
  durchschnittIntervallEur = 0,
  hatPrognose = false,
  hoehe = 220,
}: {
  daten: GestapelterDivMonat[]
  durchschnittIntervallEur?: number
  hatPrognose?: boolean
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

  const erstePrognoseIdx = daten.findIndex((d) => d.istPrognose)

  type BarRow = {
    x: number
    cx: number
    label: string
    istPrognose: boolean
    segs: {
      x: number
      y: number
      w: number
      h: number
      key: string
      label: string
      wert: number
      farbe: string
      istPrognose: boolean
      bestaetigt: boolean
    }[]
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
      return { x, cx, label: d.label, istPrognose: d.istPrognose, segs, gesamt: d.gesamt, ttm: d.ttmMonatlichEur, ttmY }
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
    return <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Noch zu wenig Dividenden-Daten.</p>
  }

  const tooltipExtraPad =
    activeDaten != null ? Math.min(480, 64 + activeDaten.segmente.length * 28) : 0

  const prognoseGrenzeX =
    erstePrognoseIdx >= 0 ? bars[erstePrognoseIdx]?.cx ?? null : null

  return (
    <div
      ref={outerRef}
      className="relative w-full min-w-0"
      style={{ paddingBottom: tooltipExtraPad }}
    >
      <div
        ref={containerRef}
        className={`relative w-full cursor-crosshair ${appTableScrollInlineClassName}`}
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
          aria-label="Dividenden pro Monat mit TTM-Trend und Prognose"
          className="pointer-events-none block min-w-full select-none"
        >
          <defs>
            <pattern id="pa-div-prognose-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(251,191,36,0.12)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(251,191,36,0.55)" strokeWidth="1.5" />
            </pattern>
          </defs>

          {hatPrognose && prognoseGrenzeX != null ? (
            <rect
              x={prognoseGrenzeX - 6}
              y={padOben}
              width={breite - padRechts - prognoseGrenzeX + 6}
              height={plotH}
              fill="url(#pa-div-prognose-stripe)"
            />
          ) : null}

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
                <text x={padLinks - 4} y={y + 3} textAnchor="end" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
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
                <g key={s.key}>
                  <rect
                    x={s.x}
                    y={s.y}
                    width={s.w}
                    height={Math.max(1, s.h)}
                    fill={s.farbe}
                    opacity={s.istPrognose ? 0.55 : 1}
                  />
                  {s.istPrognose ? (
                    <rect
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={Math.max(1, s.h)}
                      fill="none"
                      stroke={s.bestaetigt ? '#fbbf24' : '#c084fc'}
                      strokeWidth={1}
                      strokeDasharray={s.bestaetigt ? '0' : '2 2'}
                    />
                  ) : null}
                </g>
              ))}
              {i % labelStep === 0 || i === bars.length - 1 ? (
                <text
                  x={b.cx}
                  y={hoehe - 8}
                  textAnchor="middle"
                  className={b.istPrognose ? 'fill-amber-300/90' : 'fill-[var(--app-text-muted)]'}
                  style={{ fontSize: 8 }}
                >
                  {b.label}
                </text>
              ) : null}
            </g>
          ))}

          {hatPrognose && prognoseGrenzeX != null ? (
            <line
              x1={prognoseGrenzeX - 4}
              y1={padOben}
              x2={prognoseGrenzeX - 4}
              y2={padOben + plotH}
              stroke="#fbbf24"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          ) : null}

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
          className="pointer-events-none absolute z-20 w-max max-w-[min(100%,320px)] rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-xs shadow-xl sm:min-w-[260px]"
          style={{
            left: tooltipLeft,
            top: hoehe + 6,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-[var(--app-border)] pb-2">
            <span className="flex items-center gap-2 font-medium text-[var(--app-text)]">
              {activeDaten.tooltipTitel}
              {activeDaten.istPrognose ? (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  Schätzung
                </span>
              ) : null}
            </span>
            <span className="tabular-nums font-semibold text-[var(--app-text)]">{formatEur(active.gesamt)}</span>
          </div>
          <div className="space-y-1.5">
            {durchschnittIntervallEur > 0 ? (
              <div className="flex justify-between gap-4">
                <span className="text-[var(--app-text-muted)]">Ø Dividende im Intervall</span>
                <span className="tabular-nums text-[var(--app-text)]">{formatEur(durchschnittIntervallEur)}</span>
              </div>
            ) : null}
            {active.ttm != null ? (
              <div className="flex justify-between gap-4">
                <span className="text-[var(--app-text-muted)]">Ø monatl. Einkommen (TTM)</span>
                <span className="tabular-nums text-[var(--app-text)]">{formatEur(active.ttm)}</span>
              </div>
            ) : null}
          </div>
          {activeDaten.segmente.length > 0 ? (
            <ul className="mt-2 space-y-1.5 border-t border-[var(--app-border)] pt-2">
              {activeDaten.segmente.map((s) => (
                <li key={s.key} className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-[var(--app-text-muted)]">
                    <span
                      className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm border"
                      style={{
                        backgroundColor: s.farbe,
                        opacity: s.istPrognose ? 0.55 : 1,
                        borderColor: s.istPrognose ? (s.bestaetigt ? '#fbbf24' : '#c084fc') : 'transparent',
                        borderStyle: s.istPrognose && !s.bestaetigt ? 'dashed' : 'solid',
                      }}
                    />
                    <span className="leading-snug break-words">
                      {s.label}
                      {s.istPrognose && !s.bestaetigt ? (
                        <span className="ml-1 text-[10px] text-violet-300">(Muster)</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--app-text)]">{formatEur(s.wert)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-[var(--app-text-muted)]">
        {ttmPath ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-[var(--app-text-muted)]" />
            Ø monatl. Einkommen (TTM)
          </span>
        ) : null}
        {durchschnittIntervallEur > 0 ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 border-t border-dashed border-[var(--app-border-strong)]" />
            Ø Dividende im Intervall
          </span>
        ) : null}
        {hatPrognose ? (
          <>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-sm border border-amber-400/80 bg-amber-500/25" />
              Schätzung (angekündigt)
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-sm border border-dashed border-violet-400/80 bg-violet-500/20" />
              Schätzung (Muster)
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}
