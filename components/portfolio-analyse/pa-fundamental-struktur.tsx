'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'

import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  PaStrukturKennzahl,
  PaStrukturOwnershipDonut,
} from '@/components/portfolio-analyse/struktur/pa-struktur-visuals'
import { PaMsSegmentHistorieLoader } from '@/components/portfolio-analyse/struktur/pa-ms-segment-historie-loader'
import {
  baueOwnershipSegmente,
  strukturKmText,
} from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'

type StrukturKapitel = 'eigentuemer' | 'umsatzmix' | 'backlog'

const KAPITEL: { id: StrukturKapitel; label: string; kurz: string }[] = [
  { id: 'eigentuemer', label: 'Eigentümer', kurz: 'Holders' },
  { id: 'umsatzmix', label: 'Umsatzmix', kurz: 'Geo · Produkt' },
  { id: 'backlog', label: 'Backlog', kurz: 'RPO · Quartale' },
]

export function PaFundamentalStruktur({
  paket,
  ticker,
  symbolYahoo,
  isin,
}: {
  paket: FundamentaldatenPaket | null
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
  selectionKey?: string
}) {
  const erweitert = paket?.erweitert
  const navId = useId()
  const [aktiv, setAktiv] = useState<StrukturKapitel>('eigentuemer')

  useEffect(() => {
    const ids = KAPITEL.map((k) => `pa-struktur-${k.id}`)
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n != null)
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const sichtbar = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!sichtbar?.target?.id) return
        const id = sichtbar.target.id.replace('pa-struktur-', '') as StrukturKapitel
        if (KAPITEL.some((k) => k.id === id)) setAktiv(id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.35, 0.55] },
    )
    for (const n of nodes) observer.observe(n)
    return () => observer.disconnect()
  }, [erweitert?.geladenAm, paket?.symbolYahoo])

  if (!paket?.ok) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Strukturdaten werden geladen …
      </PaCard>
    )
  }

  if (!erweitert) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Erweiterte Strukturdaten werden geladen …
      </PaCard>
    )
  }

  const ownership = baueOwnershipSegmente(erweitert)
  const hatEigentuemer =
    ownership.length > 0 ||
    erweitert.holders != null ||
    strukturKmText(paket, 'float') != null ||
    strukturKmText(paket, 'shares_out') != null
  const hatSegment = Boolean(erweitert.secSegmentHistorie)

  if (!hatEigentuemer && !hatSegment) {
    return (
      <PaCard className="p-6 text-sm text-[var(--app-text-muted)]">
        Für diesen Titel konnten keine Strukturdaten geladen werden.
      </PaCard>
    )
  }

  function springeZu(id: StrukturKapitel) {
    setAktiv(id)
    document.getElementById(`pa-struktur-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-5">
      <nav
        aria-label="Struktur-Kapitel"
        className="sticky top-0 z-20 -mx-1 rounded-2xl border border-[var(--app-border)]/60 bg-[var(--app-surface)]/85 p-1.5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="grid grid-cols-3 gap-1" role="tablist" id={navId}>
          {KAPITEL.map((k) => {
            const aktivTab = aktiv === k.id
            return (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={aktivTab}
                onClick={() => springeZu(k.id)}
                className={`rounded-xl px-2.5 py-2.5 text-left transition-all duration-300 ${
                  aktivTab
                    ? 'bg-teal-500/20 text-teal-100 shadow-sm ring-1 ring-teal-400/35'
                    : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]/50 hover:text-[var(--app-text)]'
                }`}
              >
                <span className="block text-[12px] font-semibold tracking-tight">{k.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">{k.kurz}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <StrukturKapitelShell
        id="eigentuemer"
        titel="Eigentümerstruktur"
        untertitel="Insider · Institutionen · Float"
      >
        {hatEigentuemer ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="rounded-2xl border border-[var(--app-border)]/50 bg-gradient-to-br from-[var(--app-surface-muted)]/40 via-transparent to-teal-500/[0.06] p-4 sm:p-5">
              <PaStrukturOwnershipDonut segmente={ownership} />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <PaStrukturKennzahl
                label="Float"
                wert={
                  erweitert.holders?.floatShares != null
                    ? `${(erweitert.holders.floatShares / 1e6).toFixed(1)} Mio. Aktien`
                    : strukturKmText(paket, 'float')
                }
              />
              <PaStrukturKennzahl
                label="Ausstehende Aktien"
                wert={strukturKmText(paket, 'shares_out')}
              />
              {ownership.map((s) => (
                <PaStrukturKennzahl
                  key={s.key}
                  label={s.label}
                  wert={`${s.anteilPct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--app-text-muted)]">Keine Eigentümerdaten verfügbar.</p>
        )}
      </StrukturKapitelShell>

      <PaMsSegmentHistorieLoader
        key={isin?.trim() || ticker?.trim() || symbolYahoo?.trim() || paket.symbolYahoo || 'seg'}
        isin={isin}
        name={paket.firmenname}
        symbolYahoo={symbolYahoo ?? paket.symbolYahoo}
        ticker={ticker}
        initial={erweitert.secSegmentHistorie}
        umsatzZeile={paket.zeilen.find((z) => z.id === 'umsatz') ?? null}
        layout="struktur"
      />

      <p className="px-1 text-[10px] leading-relaxed text-[var(--app-text-muted)]">
        US: SEC EDGAR · Eigentümer: Yahoo / Finviz · Stand{' '}
        {new Date(erweitert.geladenAm).toLocaleString('de-DE')}
      </p>
    </div>
  )
}

function StrukturKapitelShell({
  id,
  titel,
  untertitel,
  children,
}: {
  id: StrukturKapitel
  titel: string
  untertitel: string
  children: ReactNode
}) {
  return (
    <section
      id={`pa-struktur-${id}`}
      className="scroll-mt-24 space-y-4 rounded-2xl border border-[var(--app-border)]/55 bg-[var(--app-surface)]/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5"
    >
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--app-border)]/45 pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-teal-300/80">
            Struktur
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white sm:text-lg">
            {titel}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{untertitel}</p>
        </div>
      </header>
      {children}
    </section>
  )
}
