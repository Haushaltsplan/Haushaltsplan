'use client'

import type { ReactNode } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'
import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  berichtszeitBadgeTitel,
  berichtszeitLabel,
  type Berichtszeit,
} from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

const MONAT_KURZ = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'] as const

function datumSpalte(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return {
    tag: String(d).padStart(2, '0'),
    monat: MONAT_KURZ[m - 1] ?? '',
    jahr: String(y),
  }
}

function formatStueckTag(stueck: number): string {
  return `${stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })}×`
}

export function PaEarningsBerichtszeitBadge({
  zeit,
  size = 'default',
}: {
  zeit: Berichtszeit | null
  size?: 'default' | 'mini'
}) {
  const title = berichtszeitBadgeTitel(zeit)
  const mini = size === 'mini'
  const pad = mini ? 'px-1.5 py-0.5 text-[8px] tracking-[0.08em]' : 'px-2.5 py-1 text-[10px] tracking-[0.12em]'
  const dot = mini ? 'h-1 w-1' : 'h-1.5 w-1.5'

  if (zeit === 'vor_boersenoeffnung') {
    return (
      <span
        title={title}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/[0.12] font-semibold uppercase text-sky-200 ${pad}`}
      >
        <span className={`${dot} rounded-full bg-sky-400`} aria-hidden />
        {mini ? 'VOR' : 'Vor Börse'}
      </span>
    )
  }

  if (zeit === 'nach_handelsschluss') {
    return (
      <span
        title={title}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/[0.12] font-semibold uppercase text-violet-200 ${pad}`}
      >
        <span className={`${dot} rounded-full bg-violet-400`} aria-hidden />
        {mini ? 'NACH' : 'Nach Schluss'}
      </span>
    )
  }

  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded-full border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] font-medium text-[var(--app-text-muted)] ${pad}`}
    >
      {mini ? '?' : 'Zeit offen'}
    </span>
  )
}

export function PaEarningsTerminRow({
  e,
  meta,
  aktiv = false,
  onClick,
  variant = 'liste',
  trailing,
}: {
  e: AnkuendigtesEarningsEintrag
  meta: Map<string, IsinMetadata>
  aktiv?: boolean
  onClick?: () => void
  variant?: 'liste' | 'kompakt'
  trailing?: ReactNode
}) {
  const { tag, monat, jahr } = datumSpalte(e.terminDatumIso)
  const zeitLabel = berichtszeitLabel(e.berichtszeit)
  const vergangen = e.terminDatumIso < heuteIsoUtc()

  const inner = (
    <>
      {variant === 'liste' ? (
        <div
          className={`flex w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-lg border py-2 ${
            vergangen
              ? 'border-[#eef0f1]/[0.04] bg-[var(--app-surface-muted)]'
              : 'border-[#eef0f1]/[0.07] bg-[#0a0a0b]'
          }`}
        >
          <span
            className={`text-xl font-semibold tabular-nums leading-none ${
              vergangen ? 'text-[var(--app-text-muted)]' : 'text-[#eef0f1]'
            }`}
          >
            {tag}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">{monat}</span>
          <span className="mt-0.5 text-[9px] tabular-nums text-[var(--app-text-muted)]">{jahr}</span>
        </div>
      ) : null}

      <PortfolioIsinLogo
        isin={e.isin}
        fallbackName={e.name}
        meta={meta}
        groesse={variant === 'liste' ? 'md' : 'sm'}
      />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold tracking-tight ${
            vergangen ? 'text-[var(--app-text-muted)]' : 'text-[#eef0f1]'
          }`}
        >
          {e.name}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
          {variant === 'kompakt' ? formatDatumDe(e.terminDatumIso) : formatDatumDe(e.terminDatumIso)}
          {zeitLabel ? (
            <span className="text-[var(--app-text-muted)]"> · {zeitLabel}</span>
          ) : null}
          {!e.bestaetigt ? <span className="text-amber-500/90"> · geschätzt</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <PaEarningsBerichtszeitBadge zeit={e.berichtszeit} />
        <div className="flex items-center gap-1.5">
          {!e.bestaetigt ? <PaDividendEstimateBadge title="Geschätzter Termin" /> : null}
          {trailing ?? (
            <span className="rounded-md bg-[var(--app-surface-muted)]/90 px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--app-text-muted)] ring-1 ring-white/[0.05]">
              {formatStueckTag(e.stueck)}
            </span>
          )}
        </div>
      </div>
    </>
  )

  const klasse = `flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
    aktiv
      ? 'border-[#eef0f1]/20 bg-[#121214] shadow-[0_0_0_1px_rgba(238,240,241,0.06)]'
      : vergangen
        ? 'border-[#eef0f1]/[0.04] bg-[var(--app-surface-muted)] opacity-90 hover:border-[#eef0f1]/10 hover:bg-[var(--app-surface-muted)]'
        : 'border-[#eef0f1]/[0.06] bg-[#0c0c0d]/90 hover:border-[#eef0f1]/12 hover:bg-[#101012]'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={klasse}>
        {inner}
      </button>
    )
  }

  return <div className={klasse}>{inner}</div>
}
