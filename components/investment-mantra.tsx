'use client'

import { useState } from 'react'
import { CollapsibleAnimatedBody, CollapsiblePillButton, LABEL_ZUKLAPPEN } from '@/components/collapsible-ui'
import { INVESTMENT_MANTRA, SEKTOR_MANTRAS, type MantraZeile } from '@/lib/investment-mantra-data'

function MantraTabellenBlock({
  zeilen,
  rowKeyPrefix,
}: {
  zeilen: readonly MantraZeile[]
  rowKeyPrefix: string
}) {
  return (
    <>
      <div className="hidden overflow-x-auto pb-0.5 md:block">
        <table className="min-w-full divide-y divide-zinc-800/90 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-3 py-2 font-semibold">Kategorie</th>
              <th className="px-3 py-2 font-semibold">Kennzahl</th>
              <th className="px-3 py-2 font-semibold">Ziel</th>
              <th className="px-3 py-2 font-semibold">Erklärung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {zeilen.map((item, i) => (
              <tr key={`${rowKeyPrefix}-${i}-${item.kennzahl}`} className="align-top">
                <td className="px-3 py-2.5 text-xs font-medium text-zinc-400">{item.kategorie}</td>
                <td className="px-3 py-2.5 font-medium text-white">{item.kennzahl}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-teal-400">{item.zielwert}</td>
                <td className="max-w-xl px-3 py-2.5 leading-relaxed text-zinc-300">{item.funktion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {zeilen.map((item, i) => (
          <article
            key={`${rowKeyPrefix}-m-${i}-${item.kennzahl}`}
            className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{item.kategorie}</p>
            <p className="mt-1 text-sm font-medium text-white">{item.kennzahl}</p>
            <p className="mt-1 text-sm font-semibold text-teal-400">{item.zielwert}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.funktion}</p>
          </article>
        ))}
      </div>
    </>
  )
}

export function InvestmentMantra({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false)

  const shell = embedded ? 'space-y-3' : 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4'

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mantra</p>
          <h2 className={`font-semibold tracking-tight text-white ${embedded ? 'text-base' : 'text-lg'}`}>
            Kennzahlen-Check
          </h2>
        </div>
        <CollapsiblePillButton
          open={open}
          onClick={() => setOpen((v) => !v)}
          labels={LABEL_ZUKLAPPEN}
          compact
          aria-expanded={open}
        />
      </div>

      <CollapsibleAnimatedBody open={open} className="mt-3">
        <div className="space-y-10">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">Standard-Mantra (Quality Compounding)</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Universelle Benchmarks für langfristige Qualitäts-Investments — unabhängig von der Branche.
            </p>
            <div className="mt-4">
              <MantraTabellenBlock zeilen={INVESTMENT_MANTRA} rowKeyPrefix="standard" />
            </div>
          </div>

          {SEKTOR_MANTRAS.map((block) => (
            <div key={block.id}>
              <h3 className="text-sm font-semibold tracking-tight text-white">{block.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{block.intro}</p>
              <div className="mt-4">
                <MantraTabellenBlock zeilen={block.zeilen} rowKeyPrefix={block.id} />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleAnimatedBody>
    </section>
  )
}
