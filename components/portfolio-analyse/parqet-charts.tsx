'use client'

import { useId, useMemo } from 'react'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'

/** Flächen-Chart (Parqet-ähnlich): Portfolio-Wert über Zeit. */
export function PaAreaChart({
  punkte,
  hoehe = 220,
}: {
  punkte: { label: string; wert: number }[]
  hoehe?: number
}) {
  const gradId = useId()
  const breite = Math.max(400, punkte.length * 36)
  const padLinks = 52
  const padRechts = 16
  const padOben = 20
  const padUnten = 28
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { path, area, min, max, dots } = useMemo(() => {
    if (punkte.length === 0) return { path: '', area: '', min: 0, max: 1, dots: [] }
    const werte = punkte.map((p) => p.wert)
    const minV = Math.min(...werte) * 0.98
    const maxV = Math.max(...werte) * 1.02 || 1
    const span = maxV - minV || 1
    const n = punkte.length
    const pts = punkte.map((p, i) => {
      const x = padLinks + (plotW * i) / Math.max(1, n - 1)
      const y = padOben + plotH - ((p.wert - minV) / span) * plotH
      return { x, y, ...p }
    })
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const baseY = padOben + plotH
    const areaPath = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`
    return { path: line, area: areaPath, min: minV, max: maxV, dots: pts }
  }, [punkte, plotW, plotH, padLinks, padOben])

  if (punkte.length < 2) {
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Historie für einen Verlauf.</p>
  }

  const labelStep = Math.max(1, Math.ceil(punkte.length / 8))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: breite }}
        role="img"
        aria-label="Portfolio-Verlauf"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line
          x1={padLinks}
          y1={padOben + plotH}
          x2={breite - padRechts}
          y2={padOben + plotH}
          stroke="#27272a"
          strokeWidth={1}
        />
        <text x={padLinks - 6} y={padOben + 4} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
          {formatEur(max)}
        </text>
        <text x={padLinks - 6} y={padOben + plotH} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
          {formatEur(min)}
        </text>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" />
        {dots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#10b981">
            <title>{`${p.label}: ${formatEur(p.wert)}`}</title>
          </circle>
        ))}
        {punkte.map((p, i) =>
          i % labelStep === 0 || i === punkte.length - 1 ? (
            <text
              key={p.label}
              x={dots[i]?.x ?? 0}
              y={hoehe - 6}
              textAnchor="middle"
              className="fill-zinc-500"
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
      const y = padOben + ((0 - p.drawdownProzent) / span) * plotH
      return { x, y, ...p }
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
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Historie für Drawdown.</p>
  }

  const minDd = Math.min(...punkte.map((p) => p.drawdownProzent))
  const floor = Math.floor(minDd / 10) * 10 - 10
  const span = 0 - floor || 10
  const labelStep = Math.max(1, Math.ceil(punkte.length / 8))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: breite }}
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
                stroke="#27272a"
                strokeWidth={1}
              />
              <text
                x={breite - padRechts + 4}
                y={y + 3}
                className="fill-zinc-600"
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
              className="fill-zinc-500"
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
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Daten.</p>
  }

  const labelStep = Math.max(1, Math.ceil(punkte.length / 10))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: breite }}
        role="img"
        aria-label="Performance-Verlauf"
      >
        <line
          x1={padLinks}
          y1={zeroY}
          x2={breite - padRechts}
          y2={zeroY}
          stroke="#3f3f46"
          strokeWidth={1}
        />
        <text x={breite - padRechts + 2} y={zeroY + 3} className="fill-zinc-600" style={{ fontSize: 9 }}>
          0{yAxisProzent ? '%' : ''}
        </text>
        <text x={padLinks - 4} y={padOben + 4} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
          {yAxisProzent ? `+${yMax.toFixed(0)}%` : formatEur(yMax)}
        </text>
        <text x={padLinks - 4} y={padOben + plotH} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
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
              className="fill-zinc-500"
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
    return <p className="py-12 text-center text-sm text-zinc-500">Noch keine Dividenden im Zeitraum.</p>
  }

  const labelStep = Math.max(1, Math.ceil(punkte.length / 10))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: breite }}
        role="img"
        aria-label="Dividenden pro Monat"
      >
        <line x1={padLinks} y1={baseY} x2={breite - padRechts} y2={baseY} stroke="#27272a" strokeWidth={1} />
        <text x={breite - padRechts + 2} y={baseY + 3} className="fill-zinc-600" style={{ fontSize: 9 }}>
          0
        </text>
        <text x={padLinks - 4} y={padOben + 4} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
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
              className="fill-zinc-500"
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
