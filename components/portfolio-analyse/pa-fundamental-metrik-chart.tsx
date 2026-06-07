'use client'

import { useMemo } from 'react'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const FARBEN = ['#d97706', '#38bdf8', '#34d399', '#a78bfa', '#fb7185', '#fbbf24']

const VIEW_W = 1000

export function PaFundamentalMetrikChart({
  perioden,
  zeilen,
  aktivIds,
  labelsAnzeigen,
  onClear,
  onToggleLabels,
}: {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  aktivIds: Set<string>
  labelsAnzeigen: boolean
  onClear: () => void
  onToggleLabels: () => void
}) {
  const serien = useMemo(
    () =>
      zeilen
        .filter((z) => aktivIds.has(z.id))
        .map((z, i) => ({
          id: z.id,
          label: z.label,
          farbe: FARBEN[i % FARBEN.length],
          einheit: z.einheit,
          punkte: perioden
            .map((p) => ({ label: p.label, wert: z.werte[p.iso] }))
            .filter((pt): pt is { label: string; wert: number } => pt.wert != null),
        })),
    [zeilen, aktivIds, perioden],
  )

  const hoehe = 240
  const padLinks = 48
  const padRechts = serien.length > 1 ? 48 : 16
  const padOben = 28
  const padUnten = 32
  const plotW = VIEW_W - padLinks - padRechts
  const plotH = hoehe - padOben - padUnten

  const { paths, minL, maxL, minR, maxR } = useMemo(() => {
    if (serien.length === 0) {
      return { paths: [], minL: 0, maxL: 1, minR: 0, maxR: 1 }
    }
    const links = serien.filter((_, i) => i % 2 === 0)
    const rechts = serien.filter((_, i) => i % 2 === 1)
    const wLinks = links.flatMap((s) => s.punkte.map((p) => p.wert))
    const wRechts = rechts.flatMap((s) => s.punkte.map((p) => p.wert))
    const minL = Math.min(...wLinks, 0)
    const maxL = Math.max(...wLinks, 1)
    const minR = wRechts.length ? Math.min(...wRechts, 0) : minL
    const maxR = wRechts.length ? Math.max(...wRechts, 1) : maxL
    const spanL = maxL - minL || 1
    const spanR = maxR - minR || 1
    const n = Math.max(...serien.map((s) => s.punkte.length), 1)

    const paths = serien.map((s, si) => {
      const rechtsAchse = si % 2 === 1
      const min = rechtsAchse ? minR : minL
      const span = rechtsAchse ? spanR : spanL
      const pts = s.punkte.map((p, i) => {
        const x = padLinks + (plotW * i) / Math.max(1, n - 1)
        const y = padOben + plotH - ((p.wert - min) / span) * plotH
        return { x, y, ...p }
      })
      const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      return { ...s, pts, d, rechtsAchse }
    })
    return { paths, minL, maxL, minR, maxR }
  }, [serien, padLinks, plotH, plotW, padOben])

  if (serien.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-10 text-center">
        <p className="text-xs text-zinc-500">Klicke auf eine Kennzahl in der Tabelle, um den Verlauf anzuzeigen.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">Historischer Kennzahlenverlauf</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleLabels}
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            {labelsAnzeigen ? 'Labels ausblenden' : 'Labels anzeigen'}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Chart leeren
          </button>
        </div>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${hoehe}`} className="w-full" role="img">
        <line x1={padLinks} y1={padOben + plotH} x2={VIEW_W - padRechts} y2={padOben + plotH} stroke="#3f3f46" />
        {paths.map((s) => (
          <g key={s.id}>
            <path d={s.d} fill="none" stroke={s.farbe} strokeWidth={2} strokeLinejoin="round" />
            {labelsAnzeigen
              ? s.pts.map((pt, i) => (
                  <text key={i} x={pt.x} y={pt.y - 8} textAnchor="middle" fill={s.farbe} style={{ fontSize: 9 }}>
                    {formatFundamentalWert(pt.wert, s.einheit)}
                  </text>
                ))
              : null}
          </g>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
        {paths.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: s.farbe }} />
            {s.label}
            {s.rechtsAchse ? ' (rechte Achse)' : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
