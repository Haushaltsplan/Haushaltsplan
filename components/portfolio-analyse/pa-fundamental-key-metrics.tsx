'use client'

import { PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const GRUPPEN: { id: FundamentalKeyMetric['gruppe']; titel: string }[] = [
  { id: 'marktdaten', titel: 'Marktdaten' },
  { id: 'effizienz', titel: 'Effizienz (TTM)' },
  { id: 'bewertung', titel: 'Bewertung' },
  { id: 'kapitalstruktur', titel: 'Kapitalstruktur' },
  { id: 'wachstum', titel: 'Wachstum' },
]

function MetrikGruppe({ titel, items }: { titel: string; items: FundamentalKeyMetric[] }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 p-3 ring-1 ring-white/[0.02]">
      <h4 className="mb-2.5 border-b border-zinc-800/80 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-500/90">
        {titel}
      </h4>
      <dl className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
            <dt className="truncate text-[10px] leading-snug text-zinc-500" title={m.label}>
              {m.label}
            </dt>
            <dd className="shrink-0 text-right text-[11px] font-medium tabular-nums text-zinc-100">{m.wert}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function PaFundamentalKeyMetrics({ metriken }: { metriken: FundamentalKeyMetric[] }) {
  const sichtbar = GRUPPEN.map((g) => ({
    ...g,
    items: metriken.filter((m) => m.gruppe === g.id),
  })).filter((g) => g.items.length > 0)

  if (sichtbar.length === 0) return null

  return (
    <div className={`h-full max-h-[min(70vh,520px)] ${PA_SCROLL_ELEGANT}`}>
      <div className="grid grid-cols-1 gap-2.5 pr-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {sichtbar.map((g) => (
          <MetrikGruppe key={g.id} titel={g.titel} items={g.items} />
        ))}
      </div>
    </div>
  )
}
