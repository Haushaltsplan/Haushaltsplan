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
  kompakt?: boolean
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] text-[var(--app-text-muted)] ring-1 ring-white/[0.03]">
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
  kompakt = false,
}: Props<T>) {
  const [beschreibungOffen, setBeschreibungOffen] = useState(false)
  const websiteUrl = website ? (website.startsWith('http') ? website : `https://${website}`) : null

  if (kompakt) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-[var(--app-text)]">{ticker}</span>
          <span className="text-sm text-[var(--app-text-muted)]">{firmenname}</span>
        </div>
        <PaIconTabs tabs={tabs} active={activeTab} onChange={onTabChange} className="shrink-0" />
      </div>
    )
  }

  return (
    <PaCard variant="elevated" className="overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">{firmenname}</h2>
            <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-300 ring-1 ring-teal-400/20">
              {ticker}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
            {beschreibung ? (
              <button
                type="button"
                onClick={() => setBeschreibungOffen((v) => !v)}
                className="text-[11px] font-medium text-teal-400/90 transition hover:text-teal-300"
              >
                {beschreibungOffen ? 'Profil ausblenden' : 'Über das Unternehmen'}
              </button>
            ) : null}
          </div>
        </div>
        <PaIconTabs tabs={tabs} active={activeTab} onChange={onTabChange} className="shrink-0 sm:max-w-[34rem]" />
      </div>

      {beschreibung && beschreibungOffen ? (
        <div className="border-t border-white/[0.04] bg-[var(--app-surface-muted)] px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
            Über das Unternehmen
          </h3>
          <p className="text-sm leading-relaxed text-[var(--app-text)]">{beschreibung}</p>
        </div>
      ) : null}
    </PaCard>
  )
}
