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
