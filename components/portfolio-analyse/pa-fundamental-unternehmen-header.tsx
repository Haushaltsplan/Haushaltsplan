'use client'

import { useState, type ReactNode } from 'react'
import { PaCard, PaIconTabs } from '@/components/portfolio-analyse/pa-ui'

type Tab<T extends string> = { id: T; label: string }

type Props<T extends string> = {
  firmenname: string
  ticker: string
  branche: string | null
  sektor: string | null
  website: string | null
  beschreibung: string | null
  tabs: Tab<T>[]
  activeTab: T
  onTabChange: (id: T) => void
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-zinc-900/70 px-2 py-0.5 text-[11px] text-zinc-400 ring-1 ring-white/[0.03]">
      {children}
    </span>
  )
}

export function PaFundamentalUnternehmenHeader<T extends string>({
  firmenname,
  ticker,
  branche,
  sektor,
  website,
  beschreibung,
  tabs,
  activeTab,
  onTabChange,
}: Props<T>) {
  const [beschreibungOffen, setBeschreibungOffen] = useState(false)
  const websiteUrl = website ? (website.startsWith('http') ? website : `https://${website}`) : null
  const kurzText =
    beschreibung && beschreibung.length > 320 && !beschreibungOffen
      ? `${beschreibung.slice(0, 317).trim()}…`
      : beschreibung

  return (
    <PaCard variant="elevated" className="overflow-hidden">
      <div className="border-b border-white/[0.05] bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-zinc-950 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{firmenname}</h2>
              <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums tracking-wide text-teal-300 ring-1 ring-teal-400/20">
                {ticker}
              </span>
            </div>

            {(branche || sektor || websiteUrl) && (
              <div className="flex flex-wrap gap-1.5">
                {sektor ? <MetaChip>{sektor}</MetaChip> : null}
                {branche ? <MetaChip>{branche}</MetaChip> : null}
                {websiteUrl ? (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[11px] text-amber-300/90 ring-1 ring-amber-500/10 transition hover:bg-amber-500/15 hover:text-amber-200"
                  >
                    Website ↗
                  </a>
                ) : null}
              </div>
            )}
          </div>

          <PaIconTabs tabs={tabs} active={activeTab} onChange={onTabChange} className="shrink-0 lg:max-w-[34rem]" />
        </div>
      </div>

      {beschreibung ? (
        <div className="border-b border-white/[0.04] px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Über das Unternehmen
          </h3>
          <p className="text-sm leading-relaxed text-zinc-300">{kurzText}</p>
          {beschreibung.length > 320 ? (
            <button
              type="button"
              onClick={() => setBeschreibungOffen((v) => !v)}
              className="mt-2 text-xs font-medium text-teal-400/90 transition hover:text-teal-300"
            >
              {beschreibungOffen ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            </button>
          ) : null}
        </div>
      ) : null}
    </PaCard>
  )
}
