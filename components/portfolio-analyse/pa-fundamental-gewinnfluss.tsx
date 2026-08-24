'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  baueGewinnfluss,
  GEWINNFLUSS_VIEW_H,
  GEWINNFLUSS_VIEW_W,
  gewinnflussJahre,
  knotenBeschriftung,
  layoutGewinnfluss,
  verfuegbareGewinnflussSegmentArt,
  type GewinnflussSegmentArt,
} from '@/lib/portfolio-analyse/fundamentaldaten-gewinnfluss'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function kuerze(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export function PaFundamentalGewinnfluss({ paket }: { paket: FundamentaldatenPaket }) {
  const jahre = useMemo(() => gewinnflussJahre(paket), [paket])
  const segmentArten = useMemo(() => verfuegbareGewinnflussSegmentArt(paket), [paket])
  const [iso, setIso] = useState<string | null>(null)
  const [art, setArt] = useState<GewinnflussSegmentArt | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    setIso(jahre[jahre.length - 1]?.iso ?? null)
  }, [jahre])

  useEffect(() => {
    setArt(segmentArten[0] ?? null)
  }, [segmentArten])

  const modell = useMemo(() => {
    if (!iso) return null
    return baueGewinnfluss(paket, iso, art)
  }, [paket, iso, art])

  const layout = useMemo(() => {
    if (!modell) return null
    return layoutGewinnfluss(modell, GEWINNFLUSS_VIEW_W, GEWINNFLUSS_VIEW_H)
  }, [modell])

  const minSpalte = modell && modell.knoten.length > 0 ? Math.min(...modell.knoten.map((n) => n.spalte)) : 0
  const maxSpalte = modell && modell.knoten.length > 0 ? Math.max(...modell.knoten.map((n) => n.spalte)) : 0
  const jahrIndex = iso ? jahre.findIndex((j) => j.iso === iso) : -1
  const jahrLabel = jahrIndex >= 0 ? jahre[jahrIndex]!.label : '–'

  const verbunden = useMemo(() => {
    if (!hoverId || !modell) return new Set<string>()
    const s = new Set<string>([hoverId])
    for (const k of modell.kanten) {
      if (k.von === hoverId || k.nach === hoverId) {
        s.add(k.von)
        s.add(k.nach)
      }
    }
    return s
  }, [hoverId, modell])

  if (jahre.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-10 text-center text-sm text-[var(--app-text-muted)] ring-1 ring-white/[0.03]">
        Keine GuV-Jahre mit Umsatz — Gewinnfluss kann nicht gezeichnet werden.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--app-border)] px-4 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
          Geschäftsjahr
        </span>
        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          <span className="w-8 text-[11px] tabular-nums text-[var(--app-text-muted)]">{jahre[0]?.label}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, jahre.length - 1)}
            step={1}
            value={Math.max(0, jahrIndex)}
            onChange={(e) => setIso(jahre[Number(e.target.value)]?.iso ?? iso)}
            className="h-1.5 w-full max-w-xl cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-400"
            aria-label="Geschäftsjahr"
          />
          <span className="w-8 text-right text-[11px] tabular-nums text-[var(--app-text-muted)]">
            {jahre[jahre.length - 1]?.label}
          </span>
          <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-sky-200">
            {jahrLabel}
          </span>
        </div>
        {segmentArten.length > 1 ? (
          <div className="inline-flex rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)] p-0.5">
            {segmentArten.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArt(a)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  art === a
                    ? 'bg-sky-600/90 text-white'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {a === 'produkt' ? 'Segmente' : 'Regionen'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-1 py-2 sm:px-3">
        {layout && modell ? (
          <svg
            viewBox={`0 0 ${GEWINNFLUSS_VIEW_W} ${GEWINNFLUSS_VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full max-h-[min(70vh,32rem)]"
            role="img"
            aria-label={`Gewinnfluss ${jahrLabel}`}
            onMouseLeave={() => setHoverId(null)}
          >
            {layout.kanten.map((k, i) => {
              const an = !hoverId || verbunden.has(k.von) || verbunden.has(k.nach)
              return (
                <path
                  key={`${k.von}-${k.nach}-${i}`}
                  d={k.d}
                  fill={k.farbe}
                  fillOpacity={an ? 0.42 : 0.08}
                  stroke={k.farbe}
                  strokeOpacity={an ? 0.55 : 0.12}
                  strokeWidth={0.6}
                />
              )
            })}
            {layout.knoten.map((k) => {
              const links = k.spalte === minSpalte
              const rechts = k.spalte === maxSpalte
              const an = !hoverId || verbunden.has(k.id)
              const voll = knotenBeschriftung(k)
              const name = kuerze(k.label, links || rechts ? 22 : 16)
              const tx = links ? k.x - 10 : k.x + k.breite + 10
              const anchor = links ? 'end' : 'start'
              const zweiZeilen = k.hoehe >= 22
              const wertTeil = voll.includes(' · ') ? voll.slice(voll.indexOf(' · ') + 3) : ''
              return (
                <g
                  key={k.id}
                  opacity={an ? 1 : 0.28}
                  onMouseEnter={() => setHoverId(k.id)}
                  className="cursor-pointer"
                >
                  <rect x={k.x} y={k.y} width={k.breite} height={k.hoehe} rx={3} fill={k.farbe} />
                  <title>{voll}</title>
                  {k.hoehe >= 8 || links || rechts ? (
                    <text
                      textAnchor={anchor}
                      className="fill-[var(--app-text)] [paint-order:stroke] stroke-[var(--app-surface-muted)] stroke-[3px] pointer-events-none"
                      fontSize={11}
                    >
                      {zweiZeilen ? (
                        <>
                          <tspan x={tx} y={k.y + k.hoehe / 2 - 6}>
                            {name}
                          </tspan>
                          <tspan x={tx} y={k.y + k.hoehe / 2 + 8} fill="#a1a1aa">
                            {wertTeil}
                          </tspan>
                        </>
                      ) : (
                        <tspan x={tx} y={k.y + k.hoehe / 2 + 4}>
                          {name}
                        </tspan>
                      )}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-[var(--app-text-muted)]">
            Für {jahrLabel} fehlen GuV-Positionen.
          </p>
        )}
      </div>
      <p className="border-t border-[var(--app-border)] px-4 py-2 text-[10px] text-[var(--app-text-muted)]">
        Fluss aus GuV: Umsatz → Kosten / Gewinn. Segmente nur, wenn SEC-/Berichtshistorie für das Jahr vorliegt.
        Blau = Umsatz, Grün = Gewinn, Rot = Aufwand. Hover hebt den Pfad hervor.
      </p>
    </div>
  )
}
