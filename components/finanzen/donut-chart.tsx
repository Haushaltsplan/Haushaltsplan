'use client'

import { CHART_TRACK } from '@/lib/chart-theme'
import { useMemo, useState } from 'react'

export type DonutSegment = {
  key: string
  label: string
  farbe: string
  betrag: number
}

const SEG_TRANSITION = 'stroke-width 0.1s cubic-bezier(0.33, 1, 0.68, 1), stroke-opacity 0.1s ease-out, filter 0.1s ease-out'
const HOVER_STROKE_BOOST = 8
const HIT_STROKE_EXTRA = 18

function kuerzeLabel(label: string, max = 16): string {
  const t = label.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatMitteWert(betrag: number, kompakt?: boolean): string {
  if (kompakt) {
    return `${Math.round(betrag).toLocaleString('de-DE')}€`
  }
  return `${betrag.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}

/**
 * Dependency-freies Donut-Diagramm (reines SVG) für Ausgaben/Einnahmen nach Kategorie.
 * Segmente werden über `stroke-dasharray` auf einem Kreis gezeichnet.
 */
export function DonutChart({
  segmente,
  groesse = 168,
  dicke = 22,
  mitte,
  interaktiv = true,
}: {
  segmente: DonutSegment[]
  groesse?: number
  dicke?: number
  /** Mitteltext im Ruhezustand; bei Hover: Segment-Label + Wert. Nur `wert` = eine Zeile (z. B. Parqet-Depot). */
  mitte?: { wert: string; label?: string }
  /** Hover: Segment springt hervor, Mitte zeigt Position (Standard: an). */
  interaktiv?: boolean
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null)

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

  const hoverSeg = hoverKey ? anteile.find((s) => s.key === hoverKey) : null
  const irgendwasHover = interaktiv && hoverKey != null

  const ruheLabel = mitte?.label ?? (!mitte ? 'GESAMT' : undefined)
  const ruheWert =
    mitte?.wert ?? `${gesamt.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`

  const centerLabel = hoverSeg ? kuerzeLabel(hoverSeg.label) : ruheLabel
  const centerWert = hoverSeg
    ? formatMitteWert(hoverSeg.betrag, Boolean(mitte && !mitte.label))
    : ruheWert
  const centerAnteil =
    hoverSeg && hoverSeg.anteil > 0
      ? `${(hoverSeg.anteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
      : null

  const zweiZeilenMitte = Boolean(ruheLabel || (hoverSeg && centerAnteil))
  const wertY = zweiZeilenMitte ? center + 12 : center + 5
  const labelY = center - (hoverSeg && centerAnteil ? 10 : 6)

  if (gesamt <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-[11px] text-[var(--app-text-muted)]"
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
      className={`shrink-0 ${interaktiv ? 'cursor-default' : ''}`}
      onMouseLeave={interaktiv ? () => setHoverKey(null) : undefined}
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke={CHART_TRACK} strokeWidth={dicke} />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {anteile.map((s) => {
          const aktiv = hoverKey === s.key
          const gedimmt = irgendwasHover && !aktiv
          const strokeW = aktiv ? dicke + HOVER_STROKE_BOOST : dicke
          return (
            <circle
              key={s.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.farbe}
              strokeWidth={strokeW}
              strokeDasharray={`${s.anteil * umfang} ${umfang}`}
              strokeDashoffset={-s.offset * umfang}
              strokeLinecap="butt"
              strokeOpacity={gedimmt ? 0.42 : 1}
              style={{
                transition: interaktiv ? SEG_TRANSITION : undefined,
                filter: aktiv ? `drop-shadow(0 0 8px ${s.farbe}88)` : undefined,
              }}
              pointerEvents="none"
            />
          )
        })}
        {interaktiv
          ? anteile.map((s) => (
              <circle
                key={`${s.key}-hit`}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="transparent"
                strokeWidth={dicke + HIT_STROKE_EXTRA}
                strokeDasharray={`${s.anteil * umfang} ${umfang}`}
                strokeDashoffset={-s.offset * umfang}
                strokeLinecap="butt"
                className="cursor-pointer"
                onMouseEnter={() => setHoverKey(s.key)}
                onTouchStart={() => setHoverKey(s.key)}
                onFocus={() => setHoverKey(s.key)}
                onBlur={() => setHoverKey(null)}
                tabIndex={0}
                aria-label={`${s.label}: ${formatMitteWert(s.betrag)}`}
              />
            ))
          : anteile.map((s) => (
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

      <g
        style={{
          transition: 'opacity 0.1s ease-out',
          opacity: 1,
        }}
      >
        {centerLabel ? (
          <text
            x={center}
            y={labelY}
            textAnchor="middle"
            className="fill-[var(--app-text-muted)]"
            style={{
              fontSize: hoverSeg ? 9 : 10,
              fontWeight: 600,
              letterSpacing: hoverSeg ? '0.02em' : '0.08em',
              transition: 'font-size 0.1s ease-out',
            }}
          >
            {centerLabel}
          </text>
        ) : null}
        <text
          x={center}
          y={wertY}
          textAnchor="middle"
          className="fill-[var(--app-text)]"
          style={{
            fontSize: hoverSeg ? 15 : mitte && !mitte.label ? 20 : 17,
            fontWeight: 700,
            transition: 'font-size 0.1s ease-out',
          }}
        >
          {centerWert}
        </text>
        {hoverSeg && centerAnteil ? (
          <text
            x={center}
            y={center + 26}
            textAnchor="middle"
            className="fill-[var(--app-text-muted)]"
            style={{ fontSize: 9, fontWeight: 500 }}
          >
            {centerAnteil}
          </text>
        ) : null}
      </g>
    </svg>
  )
}
