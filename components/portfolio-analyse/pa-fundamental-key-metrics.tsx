'use client'

import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const GRUPPEN: { id: FundamentalKeyMetric['gruppe']; titel: string }[] = [
  { id: 'marktdaten', titel: 'Marktdaten' },
  { id: 'kapitalstruktur', titel: 'Kapitalstruktur' },
  { id: 'effizienz', titel: 'Effizienz' },
  { id: 'wachstum', titel: 'Wachstum' },
]

export function PaFundamentalKeyMetrics({ metriken }: { metriken: FundamentalKeyMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {GRUPPEN.map((g) => {
        const items = metriken.filter((m) => m.gruppe === g.id)
        if (items.length === 0) return null
        return (
          <div
            key={g.id}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 ring-1 ring-white/[0.03]"
          >
            <h4 className="mb-2 border-b border-zinc-800 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
              {g.titel}
            </h4>
            <dl className="space-y-1.5">
              {items.map((m) => (
                <div key={m.id} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11px] leading-snug text-zinc-500">{m.label}</dt>
                  <dd className="shrink-0 text-right text-xs font-medium tabular-nums text-zinc-100">{m.wert}</dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </div>
  )
}
