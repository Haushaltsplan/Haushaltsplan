'use client'

import type { RenditeHeatmap } from '@/lib/portfolio-analyse/rendite-heatmap'

function formatHeatmapProzent(wert: number): string {
  return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

function heatmapFarbeProzent(
  wert: number | null,
  min: number,
  max: number,
): { bg: string; text: string } {
  if (wert == null) return { bg: 'transparent', text: 'text-zinc-600' }
  if (Math.abs(wert) < 0.005) return { bg: 'rgba(39, 39, 42, 0.55)', text: 'text-zinc-500' }

  if (wert > 0) {
    const t = max > 0 ? Math.min(1, wert / max) : 0.5
    const alpha = 0.22 + t * 0.62
    return {
      bg: `rgba(16, 185, 129, ${alpha})`,
      text: t > 0.25 ? 'text-emerald-50' : 'text-emerald-100/90',
    }
  }
  const t = min < 0 ? Math.min(1, Math.abs(wert) / Math.abs(min)) : 0.5
  const alpha = 0.22 + t * 0.62
  return {
    bg: `rgba(239, 68, 68, ${alpha})`,
    text: t > 0.25 ? 'text-rose-50' : 'text-rose-100/90',
  }
}

export function PaRenditeHeatmapGrid({
  heatmap,
  waehrung = false,
}: {
  heatmap: RenditeHeatmap
  waehrung?: boolean
}) {
  if (heatmap.zeilen.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500">Noch zu wenig Historie für eine Heatmap.</p>
  }

  const { minProzent, maxProzent } = heatmap

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr className="text-zinc-500">
            <th className="sticky left-0 z-10 bg-zinc-900/95 px-2 py-2 text-left font-medium" />
            {heatmap.spalten.map((col) => (
              <th key={col} className="px-1 py-2 text-center font-medium tabular-nums">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.zeilen.map((zeile) => (
            <tr key={zeile.jahr}>
              <td className="sticky left-0 z-10 bg-zinc-900/95 px-2 py-1 font-semibold text-zinc-200">
                {zeile.jahr}
              </td>
              {[zeile.gesamtProzent, ...zeile.monate].map((wert, i) => {
                const { bg, text } = heatmapFarbeProzent(wert, minProzent, maxProzent)
                return (
                  <td
                    key={i}
                    className={`border border-zinc-900/80 px-1 py-1.5 text-center tabular-nums ${text}`}
                    style={{ backgroundColor: bg.startsWith('rgba') ? bg : undefined }}
                  >
                    {wert == null
                      ? '—'
                      : waehrung
                        ? wert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                        : formatHeatmapProzent(wert)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
