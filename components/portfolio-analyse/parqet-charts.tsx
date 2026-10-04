'use client'

import { useId, useMemo } from 'react'
import { ChartFrame } from '@/components/chart-frame'
import { FinanzLineChart } from '@/components/charts/finanz-line-chart'
import { appTableScrollInlineClassName } from '@/components/page-shell'
import { CHART, CHART_AXIS, CHART_GRID, chartGridLinesY } from '@/lib/chart-theme'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'

/** Flächen-Chart: Portfolio-Wert über Zeit (TradingView Lightweight Charts). */
export function PaAreaChart({
  punkte,
  hoehe = 220,
}: {
  punkte: { label: string; wert: number; monat?: string }[]
  hoehe?: number
}) {
  const chartPunkte = useMemo(
    () =>
      punkte.map((p, i) => ({
        time: p.monat && /^\d{4}-\d{2}/.test(p.monat) ? p.monat : fallbackMonatsZeit(p.label, i, punkte.length),
        value: p.wert,
        label: p.label,
      })),
    [punkte],
  )

  return (
    <ChartFrame padding="compact">
      <div className={`w-full min-w-0 ${appTableScrollInlineClassName}`} role="img" aria-label="Portfolio-Verlauf">
        <FinanzLineChart punkte={chartPunkte} hoehe={hoehe} farbe={CHART.emerald} wertFormat={formatEur} />
      </div>
    </ChartFrame>
  )
}

/** Fallback wenn kein `monat` geliefert wird: gleichmäßig rückwärts vom aktuellen Monat. */
function fallbackMonatsZeit(label: string, index: number, total: number): string {
  if (/^\d{4}-\d{2}/.test(label)) return label.slice(0, 7)
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - (total - 1 - index))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Drawdown-Fläche: 0 % oben, negative Werte nach unten (Parqet-Stil). */
export function PaDrawdownChart({
  punkte,
  hoehe = 220,
}: {
  punkte: { label: string; drawdownProzent: number }[]
  hoehe?: number
}) {
  const gradId = useId()
  const breite = Math.max(400, punkte.length * 28)
  const padLinks = 44
  const padRechts = 16
  const padOben = 24
  const padUnten = 28
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { area, line, ticks, dots } = useMemo(() => {
    if (punkte.length === 0) return { area: '', line: '', ticks: [0], dots: [] }
    const minDd = Math.min(0, ...punkte.map((p) => p.drawdownProzent))
    const floor = Math.floor(minDd / 10) * 10 - 10
    const span = 0 - floor || 10
    const n = punkte.length
    const pts = punkte.map((p, i) => {
      const x = padLinks + (plotW * i) / Math.max(1, n - 1)
      const dd = Math.min(0, p.drawdownProzent)
      const y = padOben + ((0 - dd) / span) * plotH
      return { x, y, ...p, drawdownProzent: dd }
    })
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const topY = padOben
    const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${topY} L ${pts[0].x.toFixed(1)} ${topY} Z`
    const tickCount = Math.min(5, Math.ceil(Math.abs(floor) / 10))
    const ticksArr: number[] = []
    for (let t = 0; t >= floor; t -= Math.max(10, Math.ceil(span / tickCount))) {
      ticksArr.push(t)
    }
    if (!ticksArr.includes(0)) ticksArr.unshift(0)
    return { area: areaPath, line: linePath, ticks: ticksArr, dots: pts }
  }, [punkte, plotW, plotH, padLinks, padOben])

  if (punkte.length < 2) {
    return <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Noch zu wenig Historie für Drawdown.</p>
  }

  const minDd = Math.min(...punkte.map((p) => p.drawdownProzent))
  const floor = Math.floor(minDd / 10) * 10 - 10
  const span = 0 - floor || 10
  const labelStep = Math.max(1, Math.ceil(punkte.length / 8))

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <svg
        width="100%"
        height={hoehe}
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full select-none"
        role="img"
        aria-label="Drawdown-Verlauf"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f04438" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#f04438" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const y = padOben + ((0 - t) / span) * plotH
          return (
            <g key={t}>
              <line
                x1={padLinks}
                y1={y}
                x2={breite - padRechts}
                y2={y}
                stroke={CHART_AXIS}
                strokeWidth={1}
              />
              <text
                x={breite - padRechts + 4}
                y={y + 3}
                className="fill-[var(--app-text-muted)]"
                style={{ fontSize: 9 }}
              >
                {t}%
              </text>
            </g>
          )
        })}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="#f04438" strokeWidth={1.5} />
        {dots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill="#f04438">
            <title>{`${p.label}: ${p.drawdownProzent.toFixed(2)} %`}</title>
          </circle>
        ))}
        {punkte.map((p, i) =>
          i % labelStep === 0 || i === punkte.length - 1 ? (
            <text
              key={`${p.label}-${i}`}
              x={dots[i]?.x ?? 0}
              y={hoehe - 6}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 9 }}
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

/** Balken mit Vorzeichen (Monatsrendite o. Ä.). */
export function PaSignedBarChart({
  punkte,
  hoehe = 220,
  yAxisProzent = true,
}: {
  punkte: { label: string; wert: number }[]
  hoehe?: number
  yAxisProzent?: boolean
}) {
  const breite = Math.max(400, punkte.length * 22)
  const padLinks = 44
  const padRechts = 16
  const padOben = 20
  const padUnten = 36
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { bars, zeroY, yMax } = useMemo(() => {
    if (punkte.length === 0) return { bars: [], zeroY: padOben + plotH / 2, yMax: 10 }
    const vals = punkte.map((p) => p.wert)
    const absMax = Math.max(10, ...vals.map((v) => Math.abs(v))) * 1.1
    const zeroY = padOben + plotH / 2
    const n = punkte.length
    const barW = Math.max(4, (plotW / n) * 0.65)
    const bars = punkte.map((p, i) => {
      const x = padLinks + (plotW * (i + 0.5)) / n - barW / 2
      const h = (Math.abs(p.wert) / absMax) * (plotH / 2)
      const y = p.wert >= 0 ? zeroY - h : zeroY
      return { x, y, w: barW, h, ...p, pos: p.wert >= 0 }
    })
    return { bars, zeroY, yMax: absMax }
  }, [punkte, plotW, plotH, padLinks, padOben])

  if (punkte.length < 2) {
    return <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Noch zu wenig Daten.</p>
  }

  const labelStep = Math.max(1, Math.ceil(punkte.length / 10))

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <svg
        width="100%"
        height={hoehe}
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full select-none"
        role="img"
        aria-label="Performance-Verlauf"
      >
        <line
          x1={padLinks}
          y1={zeroY}
          x2={breite - padRechts}
          y2={zeroY}
          stroke={CHART_AXIS}
          strokeWidth={1}
        />
        <text x={breite - padRechts + 2} y={zeroY + 3} className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
          0{yAxisProzent ? '%' : ''}
        </text>
        <text x={padLinks - 4} y={padOben + 4} textAnchor="end" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
          {yAxisProzent ? `+${yMax.toFixed(0)}%` : formatEur(yMax)}
        </text>
        <text x={padLinks - 4} y={padOben + plotH} textAnchor="end" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
          {yAxisProzent ? `-${yMax.toFixed(0)}%` : `-${formatEur(yMax)}`}
        </text>
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={Math.max(1, b.h)}
            fill={b.pos ? '#34d399' : '#f87171'}
            rx={1}
          >
            <title>
              {`${b.label}: ${yAxisProzent ? `${b.wert.toFixed(2)} %` : formatEur(b.wert)}`}
            </title>
          </rect>
        ))}
        {punkte.map((p, i) =>
          i % labelStep === 0 ? (
            <text
              key={`${p.label}-${i}`}
              x={bars[i]?.x != null ? bars[i].x + (bars[i].w ?? 0) / 2 : 0}
              y={hoehe - 8}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 8 }}
              transform={`rotate(-35 ${bars[i]?.x != null ? bars[i].x + (bars[i].w ?? 0) / 2 : 0} ${hoehe - 8})`}
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

/** Dividenden-Balken von der Null-Linie nach oben. */
export function PaDividendBarChart({
  punkte,
  hoehe = 220,
}: {
  punkte: { label: string; wert: number }[]
  hoehe?: number
}) {
  const breite = Math.max(400, punkte.length * 22)
  const padLinks = 48
  const padRechts = 16
  const padOben = 20
  const padUnten = 32
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { bars, yMax, baseY } = useMemo(() => {
    if (punkte.length === 0) return { bars: [], yMax: 1, baseY: padOben + plotH }
    const yMax = Math.max(1, ...punkte.map((p) => p.wert)) * 1.08
    const baseY = padOben + plotH
    const n = punkte.length
    const barW = Math.max(4, (plotW / n) * 0.65)
    const bars = punkte.map((p, i) => {
      const x = padLinks + (plotW * (i + 0.5)) / n - barW / 2
      const h = (p.wert / yMax) * plotH
      return { x, y: baseY - h, w: barW, h, ...p }
    })
    return { bars, yMax, baseY }
  }, [punkte, plotW, plotH, padLinks, padOben])

  if (punkte.length < 2) {
    return <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Noch keine Dividenden im Zeitraum.</p>
  }

  const labelStep = Math.max(1, Math.ceil(punkte.length / 10))

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <svg
        width="100%"
        height={hoehe}
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full select-none"
        role="img"
        aria-label="Dividenden pro Monat"
      >
        <line x1={padLinks} y1={baseY} x2={breite - padRechts} y2={baseY} stroke={CHART_AXIS} strokeWidth={1} />
        <text x={breite - padRechts + 2} y={baseY + 3} className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
          0
        </text>
        <text x={padLinks - 4} y={padOben + 4} textAnchor="end" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
          {formatEur(yMax)}
        </text>
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={Math.max(1, b.h)} fill="#f97316" rx={1}>
            <title>{`${b.label}: ${formatEur(b.wert)}`}</title>
          </rect>
        ))}
        {punkte.map((p, i) =>
          i % labelStep === 0 ? (
            <text
              key={`${p.label}-${i}`}
              x={bars[i]?.x != null ? bars[i].x + (bars[i].w ?? 0) / 2 : 0}
              y={hoehe - 6}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 8 }}
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
