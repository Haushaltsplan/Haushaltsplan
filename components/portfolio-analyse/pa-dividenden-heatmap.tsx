'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { DividendenHeatmap } from '@/lib/portfolio-analyse/dividenden-auswertung'

function farbeEur(wert: number | null, max: number): { bg: string; text: string; useStyle: boolean } {
  if (wert == null) return { bg: 'transparent', text: 'text-[var(--app-text-muted)]', useStyle: false }
  if (wert < 0.005) return { bg: 'bg-[var(--app-surface-muted)]/40', text: 'text-[var(--app-text-muted)]', useStyle: false }
  const t = max > 0 ? Math.min(1, wert / max) : 0.5
  const alpha = 0.15 + t * 0.65
  return {
    bg: `rgba(52, 211, 153, ${alpha})`,
    text: t > 0.4 ? 'text-white' : 'text-emerald-100',
    useStyle: true,
  }
}

function Zelle({ wert, max }: { wert: number | null; max: number }) {
  const { bg, text, useStyle } = farbeEur(wert, max)
  return (
    <td
      className={`px-1.5 py-1.5 text-right tabular-nums ${text}`}
      style={useStyle ? { backgroundColor: bg } : undefined}
    >
      <span className={`inline-block min-w-[4rem] rounded px-1 py-0.5 ${!useStyle ? bg : ''}`}>
        {wert == null ? '—' : formatEur(wert)}
      </span>
    </td>
  )
}

export function PaDividendenHeatmapGrid({ heatmap }: { heatmap: DividendenHeatmap }) {
  if (heatmap.zeilen.length === 0) {
    return <p className="py-12 text-center text-sm text-[var(--app-text-muted)]">Noch keine Dividenden für eine Heatmap.</p>
  }

  const max = heatmap.maxEur

  return (
    <div className={appTableScrollClassName}>
      <table className="app-data-table w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr className="text-[var(--app-text-muted)]">
            <th className="sticky left-0 z-10 bg-[var(--app-surface-muted)] px-2 py-2 text-left font-medium" />
            {heatmap.spalten.map((col) => (
              <th key={col} className="px-1.5 py-2 text-right font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.zeilen.map((z) => (
            <tr key={z.jahr} className="border-t border-[var(--app-border)]/50">
              <td className="sticky left-0 z-10 bg-[var(--app-surface-muted)] px-2 py-1.5 font-semibold text-[var(--app-text)]">
                {z.jahr}
              </td>
              <Zelle wert={z.gesamtEur} max={max} />
              <Zelle wert={z.durchschnittEur} max={max} />
              {z.monate.map((w, i) => (
                <Zelle key={i} wert={w} max={max} />
              ))}
            </tr>
          ))}
          {heatmap.summen ? (
            <tr className="border-t border-[var(--app-border-strong)] bg-[var(--app-surface-muted)]/30">
              <td className="sticky left-0 bg-[var(--app-surface-hover)] px-2 py-2 font-bold text-[var(--app-text)]">Σ</td>
              <Zelle wert={heatmap.summen.gesamtEur} max={max} />
              <Zelle wert={heatmap.summen.durchschnittEur} max={max} />
              {heatmap.summen.monate.map((w, i) => (
                <Zelle key={i} wert={w} max={max} />
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
