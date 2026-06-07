'use client'

import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const GRUPPEN: { id: FundamentalKeyMetric['gruppe']; titel: string }[] = [
  { id: 'marktdaten', titel: 'Marktdaten' },
  { id: 'kapitalstruktur', titel: 'Kapitalstruktur' },
  { id: 'effizienz', titel: 'Effizienz' },
  { id: 'wachstum', titel: 'Wachstum' },
]

export function PaFundamentalKeyMetrics({ metriken }: { metriken: FundamentalKeyMetric[] }) {
  const sichtbar = GRUPPEN.filter((g) => metriken.some((m) => m.gruppe === g.id))
  if (sichtbar.length === 0) return null

  return (
    <PaCard variant="glass" className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Kennzahlen</h3>
        <p className="mt-0.5 text-[11px] text-zinc-600">Aktuelle Markt- und Effizienzdaten</p>
      </div>
      <div className="grid flex-1 gap-px bg-zinc-800/40 sm:grid-cols-2 xl:grid-cols-2">
        {sichtbar.map((g) => {
          const items = metriken.filter((m) => m.gruppe === g.id)
          return (
            <div key={g.id} className="bg-zinc-950/80 p-3.5">
              <h4 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-teal-400/80">
                {g.titel}
              </h4>
              <dl className="space-y-2">
                {items.map((m) => (
                  <div key={m.id} className="flex items-baseline justify-between gap-3 border-b border-zinc-800/60 pb-1.5 last:border-0 last:pb-0">
                    <dt className="min-w-0 text-[11px] leading-snug text-zinc-500">{m.label}</dt>
                    <dd className="shrink-0 text-right text-xs font-medium tabular-nums text-zinc-100">{m.wert}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    </PaCard>
  )
}
