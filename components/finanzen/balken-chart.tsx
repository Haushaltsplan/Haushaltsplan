'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { useMemo } from 'react'

export type MonatsBalken = {
  monat: string
  label: string
  einnahmen: number
  ausgaben: number
}

/**
 * Dependency-freies Balkendiagramm: je Monat ein Einnahmen- (grün) und Ausgaben-Balken (rot),
 * darüber eine Saldo-Linie. Reines SVG, responsive über viewBox.
 */
export function BalkenChart({ daten, hoehe = 200 }: { daten: MonatsBalken[]; hoehe?: number }) {
  const breite = Math.max(320, daten.length * 56)
  const padLinks = 8
  const padUnten = 26
  const padOben = 12
  const plotHoehe = hoehe - padUnten - padOben

  const { maxWert, gruppen, saldoPunkte } = useMemo(() => {
    const max = Math.max(1, ...daten.map((d) => Math.max(d.einnahmen, d.ausgaben)))
    const gruppenBreite = (breite - padLinks * 2) / Math.max(1, daten.length)
    const balkenBreite = Math.min(16, gruppenBreite / 2.6)
    const g = daten.map((d, i) => {
      const xMitte = padLinks + gruppenBreite * i + gruppenBreite / 2
      const hEin = (d.einnahmen / max) * plotHoehe
      const hAus = (d.ausgaben / max) * plotHoehe
      return {
        ...d,
        xMitte,
        balkenBreite,
        einBar: { x: xMitte - balkenBreite - 1, y: padOben + (plotHoehe - hEin), h: hEin },
        ausBar: { x: xMitte + 1, y: padOben + (plotHoehe - hAus), h: hAus },
      }
    })
    const punkte = g.map((d) => {
      const saldo = d.einnahmen - d.ausgaben
      const y = padOben + plotHoehe - ((saldo + max) / (2 * max)) * plotHoehe
      return { x: d.xMitte, y, saldo }
    })
    return { maxWert: max, gruppen: g, saldoPunkte: punkte }
  }, [daten, breite, plotHoehe])

  if (daten.length === 0) {
    return <div className="py-8 text-center text-[12px] text-[var(--app-text-muted)]">Noch keine Monatsdaten.</div>
  }

  const linePath = saldoPunkte
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  return (
    <div className={`w-full ${appTableScrollClassName}`}>
      <svg
        width="100%"
        viewBox={`0 0 ${breite} ${hoehe}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Einnahmen und Ausgaben je Monat"
        style={{ minWidth: breite }}
      >
        <line x1={padLinks} y1={padOben + plotHoehe} x2={breite - padLinks} y2={padOben + plotHoehe} stroke="#334155" strokeWidth={1} />
        {gruppen.map((d) => (
          <g key={d.monat}>
            <rect x={d.einBar.x} y={d.einBar.y} width={d.balkenBreite} height={Math.max(0, d.einBar.h)} rx={2} fill="#22c55e">
              <title>{`${d.label} – Einnahmen: ${d.einnahmen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}</title>
            </rect>
            <rect x={d.ausBar.x} y={d.ausBar.y} width={d.balkenBreite} height={Math.max(0, d.ausBar.h)} rx={2} fill="#f43f5e">
              <title>{`${d.label} – Ausgaben: ${d.ausgaben.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}</title>
            </rect>
            <text
              x={d.xMitte}
              y={hoehe - 8}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 10 }}
            >
              {d.label}
            </text>
          </g>
        ))}
        <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth={1.75} strokeLinejoin="round" opacity={0.9} />
        {saldoPunkte.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#38bdf8">
            <title>{`Saldo: ${p.saldo.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}</title>
          </circle>
        ))}
        <text x={padLinks} y={padOben + 4} className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
          {maxWert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
        </text>
      </svg>
    </div>
  )
}
