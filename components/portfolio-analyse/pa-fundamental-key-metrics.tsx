'use client'

import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const SEKTIONEN: { id: FundamentalKeyMetric['gruppe']; titel: string; spalte: 0 | 1 }[] = [
  { id: 'marktdaten', titel: 'Marktdaten', spalte: 0 },
  { id: 'kapitalstruktur', titel: 'Kapitalstruktur', spalte: 1 },
  { id: 'effizienz', titel: 'Effizienz (LTM)', spalte: 0 },
  { id: 'wachstum', titel: 'Wachstum', spalte: 1 },
  { id: 'bewertung_ntm', titel: 'Bewertung (NTM)', spalte: 0 },
  { id: 'bewertung_ltm', titel: 'Bewertung (LTM)', spalte: 1 },
]

function MetrikZeile({ label, wert }: { label: string; wert: string }) {
  const negativ = wert.startsWith('(')
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-2 leading-tight">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span
        className={`text-right text-[10px] font-semibold tabular-nums ${negativ ? 'text-rose-400/90' : 'text-zinc-100'}`}
      >
        {wert}
      </span>
    </div>
  )
}

function Sektion({ titel, items }: { titel: string; items: FundamentalKeyMetric[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="mb-1.5 border-b border-amber-500/30 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
        {titel}
      </h4>
      <div className="space-y-1">
        {items.map((m) => (
          <MetrikZeile key={m.id} label={m.label} wert={m.wert} />
        ))}
      </div>
    </div>
  )
}

export function PaFundamentalKeyMetrics({ metriken }: { metriken: FundamentalKeyMetric[] }) {
  const col0 = SEKTIONEN.filter((s) => s.spalte === 0)
  const col1 = SEKTIONEN.filter((s) => s.spalte === 1)

  return (
    <div className="grid h-full grid-cols-2 gap-x-4 gap-y-3 p-3 sm:gap-x-5 sm:p-4">
      <div className="space-y-3">
        {col0.map((s) => (
          <Sektion key={s.id} titel={s.titel} items={metriken.filter((m) => m.gruppe === s.id)} />
        ))}
      </div>
      <div className="space-y-3">
        {col1.map((s) => (
          <Sektion key={s.id} titel={s.titel} items={metriken.filter((m) => m.gruppe === s.id)} />
        ))}
      </div>
    </div>
  )
}
