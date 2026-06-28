'use client'

import { appTableScrollInlineClassName } from '@/components/page-shell'
import { useState } from 'react'
import { CollapsibleAnimatedBody, CollapsiblePillButton, LABEL_ZUKLAPPEN } from '@/components/collapsible-ui'
import {
  INVESTMENT_MANTRA,
  MOAT_CHECK,
  MOAT_CHECK_PLATTFORM_ZUSATZ,
  QUALITY_INVESTING_ANKER,
  QUALITY_INVESTING_FRAMEWORK_TITEL,
  QUALITY_INVESTING_FRAMEWORK_UNTERTITEL,
  SELL_TRIGGERS,
  SELL_TRIGGERS_HINWEIS,
  type MantraZeile,
} from '@/lib/investment-mantra-data'

function MantraTabellenBlock({
  zeilen,
  rowKeyPrefix,
}: {
  zeilen: readonly MantraZeile[]
  rowKeyPrefix: string
}) {
  return (
    <>
      <div className={`hidden ${appTableScrollInlineClassName} pb-0.5 md:block`}>
        <table className="app-data-table min-w-full divide-y divide-[var(--app-border)] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
              <th className="px-3 py-2 font-semibold">Kategorie</th>
              <th className="px-3 py-2 font-semibold">Kennzahl</th>
              <th className="px-3 py-2 font-semibold">Benchmark</th>
              <th className="px-3 py-2 font-semibold">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-border)]">
            {zeilen.map((item, i) => (
              <tr key={`${rowKeyPrefix}-${i}-${item.kennzahl}`} className="align-top">
                <td className="px-3 py-2.5 text-xs font-medium text-[var(--app-text-muted)]">{item.kategorie}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-white">{item.kennzahl}</p>
                  {item.definition ? (
                    <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-muted)]">{item.definition}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-teal-400">{item.zielwert}</td>
                <td className="max-w-xl px-3 py-2.5 leading-relaxed text-[var(--app-text)]">{item.funktion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {zeilen.map((item, i) => (
          <article
            key={`${rowKeyPrefix}-m-${i}-${item.kennzahl}`}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{item.kategorie}</p>
            <p className="mt-1 text-sm font-medium text-white">{item.kennzahl}</p>
            {item.definition ? <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">{item.definition}</p> : null}
            <p className="mt-1 text-sm font-semibold text-teal-400">{item.zielwert}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">{item.funktion}</p>
          </article>
        ))}
      </div>
    </>
  )
}

export function InvestmentMantra({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false)

  const shell = embedded ? 'space-y-3' : 'rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4'

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Mantra</p>
          <h2 className={`font-semibold tracking-tight text-white ${embedded ? 'text-base' : 'text-lg'}`}>
            {QUALITY_INVESTING_FRAMEWORK_TITEL}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{QUALITY_INVESTING_FRAMEWORK_UNTERTITEL}</p>
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
            <h3 className="text-sm font-semibold tracking-tight text-white">1. Der psychologische Anker</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--app-text)]">{QUALITY_INVESTING_ANKER}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">
              2. Quantitatives Dashboard (dynamische Kriterien)
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">
              Branchenunabhängige Benchmarks — etablierte Compounder und junge Plattformen mit unterschiedlichen
              Schwellen.
            </p>
            <div className="mt-4">
              <MantraTabellenBlock zeilen={INVESTMENT_MANTRA} rowKeyPrefix="dashboard" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">
              3. Moat-Check (qualitative Burggräben)
            </h3>
            <div className="mt-4 space-y-4">
              {MOAT_CHECK.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3"
                >
                  <p className="text-sm font-medium text-white">{p.titel}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{p.beschreibung}</p>
                  <p className="mt-3 text-sm font-medium text-amber-200/90">
                    Killer-Frage: <span className="font-normal text-[var(--app-text)]">{p.killerFrage}</span>
                  </p>
                </article>
              ))}
              <p className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3 text-sm leading-relaxed text-[var(--app-text)]">
                <span className="font-medium text-teal-300">Junge Plattformen: </span>
                {MOAT_CHECK_PLATTFORM_ZUSATZ}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">4. Sell-Triggers (Exit-Disziplin)</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">{SELL_TRIGGERS_HINWEIS}</p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[var(--app-text)]">
              {SELL_TRIGGERS.map((t) => (
                <li key={t.id}>
                  <span className="font-medium text-white">{t.titel}: </span>
                  {t.beschreibung}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CollapsibleAnimatedBody>
    </section>
  )
}
