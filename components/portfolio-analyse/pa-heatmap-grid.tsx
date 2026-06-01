'use client'

import { formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type { RenditeHeatmap } from '@/lib/portfolio-analyse/rendite-heatmap'

function heatmapFarbeProzent(
  wert: number | null,
  min: number,
  max: number,
): { bg: string; text: string } {
  if (wert == null) return { bg: 'transparent', text: 'text-zinc-600' }
  if (Math.abs(wert) < 0.005) return { bg: 'bg-zinc-800/40', text: 'text-zinc-500' }

  if (wert > 0) {
    const t = max > 0 ? Math.min(1, wert / max) : 0.5
    const alpha = 0.15 + t * 0.55
    return {
      bg: `rgba(52, 211, 153, ${alpha})`,
      text: t > 0.35 ? 'text-white' : 'text-emerald-100',
    }
  }
  const t = min < 0 ? Math.min(1, Math.abs(wert) / Math.abs(min)) : 0.5
  const alpha = 0.15 + t * 0.55
  return {
    bg: `rgba(248, 113, 113, ${alpha})`,
    text: t > 0.35 ? 'text-white' : 'text-rose-100',
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
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="text-zinc-500">
            <th className="sticky left-0 z-10 bg-zinc-900/95 px-2 py-2 text-left font-medium" />
            {heatmap.spalten.map((col) => (
              <th key={col} className="px-1.5 py-2 text-right font-medium tabular-nums">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.zeilen.map((zeile) => (
            <tr key={zeile.jahr} className="border-t border-zinc-800/50">
              <td className="sticky left-0 z-10 bg-zinc-900/95 px-2 py-1.5 font-semibold text-zinc-200">
                {zeile.jahr}
              </td>
              {[zeile.gesamtProzent, ...zeile.monate].map((wert, i) => {
                const { bg, text } = heatmapFarbeProzent(wert, minProzent, maxProzent)
                return (
                  <td
                    key={i}
                    className={`px-1.5 py-1.5 text-right tabular-nums ${text}`}
                    style={{ backgroundColor: bg.startsWith('rgba') ? bg : undefined }}
                  >
                    <span
                      className={`inline-block min-w-[3rem] rounded px-1 py-0.5 ${
                        !bg.startsWith('rgba') ? bg : ''
                      }`}
                    >
                      {wert == null
                        ? '—'
                        : waehrung
                          ? wert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                          : formatProzent(wert)}
                    </span>
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
