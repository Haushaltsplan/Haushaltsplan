'use client'

import { useMemo } from 'react'

export type DonutSegment = {
  key: string
  label: string
  farbe: string
  betrag: number
}

/**
 * Dependency-freies Donut-Diagramm (reines SVG) für Ausgaben/Einnahmen nach Kategorie.
 * Segmente werden über `stroke-dasharray` auf einem Kreis gezeichnet.
 */
export function DonutChart({
  segmente,
  groesse = 168,
  dicke = 22,
}: {
  segmente: DonutSegment[]
  groesse?: number
  dicke?: number
}) {
  const { gesamt, anteile } = useMemo(() => {
    const positiv = segmente.filter((s) => Number(s.betrag) > 0)
    const summe = positiv.reduce((a, s) => a + Number(s.betrag), 0)
    let offset = 0
    const arr = positiv.map((s) => {
      const anteil = summe > 0 ? Number(s.betrag) / summe : 0
      const seg = { ...s, anteil, offset }
      offset += anteil
      return seg
    })
    return { gesamt: summe, anteile: arr }
  }, [segmente])

  const radius = (groesse - dicke) / 2
  const umfang = 2 * Math.PI * radius
  const center = groesse / 2

  if (gesamt <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-dashed border-slate-700 text-[11px] text-slate-600"
        style={{ width: groesse, height: groesse }}
      >
        Keine Daten
      </div>
    )
  }

  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox={`0 0 ${groesse} ${groesse}`}
      role="img"
      aria-label="Verteilung nach Kategorie"
      className="shrink-0"
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#1e293b" strokeWidth={dicke} />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {anteile.map((s) => (
          <circle
            key={s.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.farbe}
            strokeWidth={dicke}
            strokeDasharray={`${s.anteil * umfang} ${umfang}`}
            strokeDashoffset={-s.offset * umfang}
            strokeLinecap="butt"
          >
            <title>{`${s.label}: ${s.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}</title>
          </circle>
        ))}
      </g>
      <text
        x={center}
        y={center - 6}
        textAnchor="middle"
        className="fill-slate-500"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}
      >
        GESAMT
      </text>
      <text
        x={center}
        y={center + 14}
        textAnchor="middle"
        className="fill-slate-100"
        style={{ fontSize: 17, fontWeight: 700 }}
      >
        {gesamt.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
      </text>
    </svg>
  )
}
