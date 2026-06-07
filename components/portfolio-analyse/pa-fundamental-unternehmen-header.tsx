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
  /** Auf der Übersichtsseite Profil direkt anzeigen */
  profilAufUebersicht?: boolean
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
  profilAufUebersicht = false,
}: Props<T>) {
  const [beschreibungOffen, setBeschreibungOffen] = useState(profilAufUebersicht && Boolean(beschreibung))
  const websiteUrl = website ? (website.startsWith('http') ? website : `https://${website}`) : null
  const zeigeProfil = beschreibung && (profilAufUebersicht || beschreibungOffen)

  return (
    <PaCard variant="elevated" className="overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{firmenname}</h2>
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
          </div>
        </div>
        <PaIconTabs tabs={tabs} active={activeTab} onChange={onTabChange} className="shrink-0 sm:max-w-[34rem]" />
      </div>

      {beschreibung && !profilAufUebersicht ? (
        <div className="border-t border-white/[0.04] px-4 py-2 sm:px-5">
          <button
            type="button"
            onClick={() => setBeschreibungOffen((v) => !v)}
            className="text-xs font-medium text-teal-400/90 transition hover:text-teal-300"
          >
            {beschreibungOffen ? '▾ Über das Unternehmen ausblenden' : '▸ Über das Unternehmen anzeigen'}
          </button>
        </div>
      ) : null}

      {zeigeProfil ? (
        <div className="border-t border-white/[0.04] bg-zinc-950/40 px-4 py-4 sm:px-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Über das Unternehmen
          </h3>
          <p className="text-sm leading-relaxed text-zinc-300">{beschreibung}</p>
        </div>
      ) : null}
    </PaCard>
  )
}
