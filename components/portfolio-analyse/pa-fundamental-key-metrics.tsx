'use client'

import { PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

/** Reihenfolge wie TIKR-Übersicht */
const GRUPPEN: { id: FundamentalKeyMetric['gruppe']; titel: string }[] = [
  { id: 'marktdaten', titel: 'Marktdaten' },
  { id: 'effizienz', titel: 'Effizienz (TTM)' },
  { id: 'bewertung', titel: 'Bewertung' },
  { id: 'kapitalstruktur', titel: 'Kapitalstruktur' },
  { id: 'wachstum', titel: 'Wachstum' },
]

function MetrikGruppe({ titel, items }: { titel: string; items: FundamentalKeyMetric[] }) {
  if (items.length === 0) return null
  return (
    <div className="min-w-[148px] border-r border-zinc-800/50 px-3 py-2.5 last:border-r-0 xl:min-w-0">
      <h4 className="mb-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-amber-500/90">
        {titel}
      </h4>
      <dl className="space-y-1.5">
        {items.map((m) => (
          <div key={m.id} className="flex items-baseline justify-between gap-2">
            <dt className="min-w-0 text-[10px] leading-snug text-zinc-500">{m.label}</dt>
            <dd className="shrink-0 text-right text-[11px] font-medium tabular-nums text-zinc-100">{m.wert}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function PaFundamentalKeyMetrics({ metriken }: { metriken: FundamentalKeyMetric[] }) {
  const sichtbar = GRUPPEN.filter((g) => metriken.some((m) => m.gruppe === g.id))
  if (sichtbar.length === 0) return null

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/70 ring-1 ring-white/[0.03]">
      <div className={`min-h-0 flex-1 ${PA_SCROLL_ELEGANT}`}>
        <div className="flex w-max min-w-full xl:grid xl:w-full xl:grid-cols-5">
          {sichtbar.map((g) => (
            <MetrikGruppe key={g.id} titel={g.titel} items={metriken.filter((m) => m.gruppe === g.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
