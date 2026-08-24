'use client'

import { useState, type ReactNode } from 'react'
import { PaIconTabs } from '@/components/portfolio-analyse/pa-ui'

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
  /** Optionale Aktionen rechts neben den Tabs (z. B. Export). */
  aktionen?: ReactNode
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
  aktionen,
}: Props<T>) {
  const [beschreibungOffen, setBeschreibungOffen] = useState(false)
  const websiteUrl = website ? (website.startsWith('http') ? website : `https://${website}`) : null

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-[var(--app-text)]">{ticker}</span>
          <span className="truncate text-sm text-[var(--app-text-muted)]">{firmenname}</span>
          {!kompakt && sektor ? <MetaChip>{sektor}</MetaChip> : null}
          {!kompakt && branche ? <MetaChip>{branche}</MetaChip> : null}
          {!kompakt && websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[11px] text-amber-300/90 ring-1 ring-amber-500/10 transition hover:bg-amber-500/15 hover:text-amber-200"
            >
              Website ↗
            </a>
          ) : null}
          {!kompakt && beschreibung ? (
            <button
              type="button"
              onClick={() => setBeschreibungOffen((v) => !v)}
              className="text-[11px] font-medium text-teal-400/90 transition hover:text-teal-300"
            >
              {beschreibungOffen ? 'Profil ausblenden' : 'Über das Unternehmen'}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {aktionen}
          <PaIconTabs tabs={tabs} active={activeTab} onChange={onTabChange} className="shrink-0" />
        </div>
      </div>
      {!kompakt && beschreibung && beschreibungOffen ? (
        <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">{beschreibung}</p>
      ) : null}
    </div>
  )
}
