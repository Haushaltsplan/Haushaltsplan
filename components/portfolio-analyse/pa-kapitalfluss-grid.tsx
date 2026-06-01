'use client'

import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { KapitalflussHeatmap } from '@/lib/portfolio-analyse/kapitalfluss-heatmap'

function heatmapFarbeEur(
  wert: number | null,
  min: number,
  max: number,
): { bg: string; text: string; useStyle: boolean } {
  if (wert == null) return { bg: 'transparent', text: 'text-zinc-600', useStyle: false }
  if (Math.abs(wert) < 0.005) return { bg: 'bg-zinc-800/50', text: 'text-zinc-500', useStyle: false }

  if (wert > 0) {
    const t = max > 0 ? Math.min(1, wert / max) : 0.5
    const alpha = 0.2 + t * 0.65
    return {
      bg: `rgba(56, 189, 248, ${alpha})`,
      text: t > 0.4 ? 'text-white' : 'text-sky-100',
      useStyle: true,
    }
  }
  const t = min < 0 ? Math.min(1, Math.abs(wert) / Math.abs(min)) : 0.5
  const alpha = 0.2 + t * 0.65
  return {
    bg: `rgba(251, 146, 60, ${alpha})`,
    text: t > 0.4 ? 'text-white' : 'text-orange-100',
    useStyle: true,
  }
}

function Zelle({
  wert,
  min,
  max,
}: {
  wert: number | null
  min: number
  max: number
}) {
  const { bg, text, useStyle } = heatmapFarbeEur(wert, min, max)
  return (
    <td
      className={`px-1.5 py-1.5 text-right tabular-nums ${text}`}
      style={useStyle ? { backgroundColor: bg } : undefined}
    >
      <span className={`inline-block min-w-[4.5rem] rounded px-1 py-0.5 ${!useStyle ? bg : ''}`}>
        {wert == null ? '—' : formatEur(wert)}
      </span>
    </td>
  )
}

export function PaKapitalflussHeatmapGrid({ heatmap }: { heatmap: KapitalflussHeatmap }) {
  if (heatmap.zeilen.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        Noch keine Käufe oder Verkäufe für eine Kapitalfluss-Auswertung.
      </p>
    )
  }

  const { minEur, maxEur } = heatmap

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-xs">
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
              <Zelle wert={zeile.gesamtEur} min={minEur} max={maxEur} />
              <Zelle wert={zeile.durchschnittEur} min={minEur} max={maxEur} />
              {zeile.monate.map((wert, i) => (
                <Zelle key={i} wert={wert} min={minEur} max={maxEur} />
              ))}
            </tr>
          ))}
          {heatmap.summen ? (
            <tr className="border-t border-zinc-700/60 bg-zinc-800/30">
              <td className="sticky left-0 z-10 bg-zinc-800/50 px-2 py-2 font-bold text-zinc-100">Σ</td>
              <Zelle wert={heatmap.summen.gesamtEur} min={minEur} max={maxEur} />
              <Zelle wert={heatmap.summen.durchschnittEur} min={minEur} max={maxEur} />
              {heatmap.summen.monate.map((wert, i) => (
                <Zelle key={i} wert={wert} min={minEur} max={maxEur} />
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
