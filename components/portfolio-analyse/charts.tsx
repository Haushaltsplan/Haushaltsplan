'use client'

import { useMemo } from 'react'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'

export function PaChartKarte({
  titel,
  hint,
  children,
  className,
}: {
  titel: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-lg shadow-black/20 ${className ?? ''}`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">{titel}</h3>
        {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function PaLinienChart({
  serien,
  hoehe = 200,
}: {
  serien: Array<{
    key: string
    farbe: string
    label: string
    punkte: { label: string; wert: number }[]
  }>
  hoehe?: number
}) {
  const allePunkte = serien.flatMap((s) => s.punkte)
  const breite = Math.max(360, allePunkte.length * 28)
  const padLinks = 44
  const padUnten = 28
  const padOben = 16
  const padRechts = 12
  const plot = hoehe - padUnten - padOben

  const { min, max, paths } = useMemo(() => {
    const werte = allePunkte.map((p) => p.wert)
    const minV = Math.min(0, ...werte)
    const maxV = Math.max(1, ...werte)
    const span = maxV - minV || 1
    const n = Math.max(1, serien[0]?.punkte.length ?? 1)
    const plotW = breite - padLinks - padRechts

    const paths = serien.map((s) => {
      const pts = s.punkte.map((p, i) => {
        const x = padLinks + (plotW * i) / Math.max(1, n - 1)
        const y = padOben + plot - ((p.wert - minV) / span) * plot
        return { x, y, ...p }
      })
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      return { ...s, pts, d }
    })
    return { min: minV, max: maxV, paths }
  }, [serien, allePunkte, breite, plot, padLinks, padOben, padRechts])

  if (allePunkte.length === 0) {
    return <p className="py-8 text-center text-xs text-zinc-600">Noch keine Verlaufsdaten.</p>
  }

  const labels = serien[0]?.punkte ?? []
  const labelStep = Math.max(1, Math.ceil(labels.length / 8))

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: breite }} role="img">
        <line x1={padLinks} y1={padOben + plot} x2={breite - padRechts} y2={padOben + plot} stroke="#3f3f46" strokeWidth={1} />
        <text x={padLinks - 4} y={padOben + 4} textAnchor="end" className="fill-zinc-600" style={{ fontSize: 9 }}>
          {formatEur(max)}
        </text>
        {paths.map((s) => (
          <g key={s.key}>
            <path d={s.d} fill="none" stroke={s.farbe} strokeWidth={2} strokeLinejoin="round" />
            {s.pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={s.farbe}>
                <title>{`${p.label}: ${formatEur(p.wert)}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {labels.map((p, i) =>
          i % labelStep === 0 || i === labels.length - 1 ? (
            <text key={i} x={padLinks + ((breite - padLinks - padRechts) * i) / Math.max(1, labels.length - 1)} y={hoehe - 8} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 9 }}>
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
        {serien.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: s.farbe }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PaMonatsBalken({
  daten,
  hoehe = 200,
  farbe = '#34d399',
}: {
  daten: { label: string; wert: number }[]
  hoehe?: number
  farbe?: string
}) {
  const breite = Math.max(320, daten.length * 48)
  const padLinks = 8
  const padUnten = 26
  const padOben = 14
  const plot = hoehe - padUnten - padOben
  const max = Math.max(1, ...daten.map((d) => d.wert))

  if (daten.every((d) => d.wert <= 0)) {
    return <p className="py-8 text-center text-xs text-zinc-600">Noch keine Daten in diesem Zeitraum.</p>
  }

  const gruppenBreite = (breite - padLinks * 2) / Math.max(1, daten.length)
  const balkenBreite = Math.min(28, gruppenBreite * 0.65)

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: breite }} role="img">
        <line x1={padLinks} y1={padOben + plot} x2={breite - padLinks} y2={padOben + plot} stroke="#3f3f46" strokeWidth={1} />
        {daten.map((d, i) => {
          const h = (d.wert / max) * plot
          const xMitte = padLinks + gruppenBreite * i + gruppenBreite / 2
          return (
            <g key={d.label + i}>
              <rect x={xMitte - balkenBreite / 2} y={padOben + (plot - h)} width={balkenBreite} height={Math.max(0, h)} rx={3} fill={farbe}>
                <title>{`${d.label}: ${formatEur(d.wert)}`}</title>
              </rect>
              <text x={xMitte} y={hoehe - 8} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 9 }}>
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function PaCashflowBalken({
  daten,
  hoehe = 200,
}: {
  daten: { label: string; eingang: number; ausgang: number }[]
  hoehe?: number
}) {
  const breite = Math.max(360, daten.length * 52)
  const padLinks = 8
  const padUnten = 26
  const padOben = 12
  const plot = hoehe - padUnten - padOben
  const max = Math.max(1, ...daten.map((d) => Math.max(d.eingang, d.ausgang)))
  const gruppenBreite = (breite - padLinks * 2) / Math.max(1, daten.length)
  const balkenBreite = Math.min(14, gruppenBreite / 2.8)

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: breite }} role="img">
        <line x1={padLinks} y1={padOben + plot} x2={breite - padLinks} y2={padOben + plot} stroke="#3f3f46" strokeWidth={1} />
        {daten.map((d, i) => {
          const xMitte = padLinks + gruppenBreite * i + gruppenBreite / 2
          const hEin = (d.eingang / max) * plot
          const hAus = (d.ausgang / max) * plot
          return (
            <g key={d.label}>
              <rect x={xMitte - balkenBreite - 1} y={padOben + plot - hEin} width={balkenBreite} height={hEin} rx={2} fill="#34d399">
                <title>{`Eingang ${formatEur(d.eingang)}`}</title>
              </rect>
              <rect x={xMitte + 1} y={padOben + plot - hAus} width={balkenBreite} height={hAus} rx={2} fill="#f43f5e">
                <title>{`Ausgang ${formatEur(d.ausgang)}`}</title>
              </rect>
              <text x={xMitte} y={hoehe - 8} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 9 }}>
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-2 text-[10px] text-zinc-500">
        <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400 align-middle" /> Eingänge ·{' '}
        <span className="inline-block h-2 w-2 rounded-sm bg-rose-500 align-middle" /> Ausgänge
      </p>
    </div>
  )
}

export function PaHorizontalBalken({
  daten,
  format = (n) => `${n.toFixed(1)} %`,
}: {
  daten: { label: string; wert: number; farbe: string }[]
  format?: (n: number) => string
}) {
  const max = Math.max(1, ...daten.map((d) => d.wert))
  return (
    <ul className="space-y-2.5">
      {daten.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-zinc-300">{d.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-400">{format(d.wert)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.wert / max) * 100}%`, background: d.farbe }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
