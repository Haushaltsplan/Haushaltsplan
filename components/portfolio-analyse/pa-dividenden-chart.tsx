'use client'

import { useMemo } from 'react'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { GestapelterDivMonat } from '@/lib/portfolio-analyse/dividenden-auswertung'

export function PaGestapelteDividendenChart({
  daten,
  ttmLinie,
  hoehe = 220,
}: {
  daten: GestapelterDivMonat[]
  ttmLinie?: number
  hoehe?: number
}) {
  const breite = Math.max(400, daten.length * 28)
  const padLinks = 48
  const padRechts = 16
  const padOben = 24
  const padUnten = 32
  const plotH = hoehe - padOben - padUnten
  const plotW = breite - padLinks - padRechts

  const { bars, yMax, ttmY } = useMemo(() => {
    if (daten.length === 0) return { bars: [], yMax: 1, ttmY: null as number | null }
    const yMax = Math.max(1, ...daten.map((d) => d.gesamt)) * 1.1
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
      return { x, label: d.label, segs, gesamt: d.gesamt }
    })

    const ttmY =
      ttmLinie != null && ttmLinie > 0
        ? padOben + plotH - (ttmLinie / yMax) * plotH
        : null

    return { bars, yMax, ttmY }
  }, [daten, plotH, plotW, padLinks, padOben, ttmLinie])

  if (daten.length < 2) {
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Dividenden-Daten.</p>
  }

  const labelStep = Math.max(1, Math.ceil(daten.length / 10))

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
        {ttmY != null ? (
          <>
            <line
              x1={padLinks}
              y1={ttmY}
              x2={breite - padRechts}
              y2={ttmY}
              stroke="#e4e4e7"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          </>
        ) : null}
        {bars.map((b, i) => (
          <g key={i}>
            {b.segs.map((s) => (
              <rect key={s.key} x={s.x} y={s.y} width={s.w} height={Math.max(1, s.h)} fill={s.farbe}>
                <title>{`${s.label}: ${formatEur(s.wert)}`}</title>
              </rect>
            ))}
            {i % labelStep === 0 ? (
              <text
                x={b.x + (b.segs[0]?.w ?? 0) / 2}
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
      </svg>
      {ttmLinie != null ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="inline-block h-px w-6 border-t border-dashed border-zinc-400" />
          Ø monatl. Einkommen (TTM): {formatEur(ttmLinie)}
        </p>
      ) : null}
    </div>
  )
}
