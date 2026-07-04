'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import type {
  NewsTerminalDepotPosition,
  NewsTerminalKategorie,
  NewsTerminalPaket,
  NewsTerminalUnternehmen,
  NewsTerminalZeile,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-types'

const KATEGORIE_LABEL: Record<NewsTerminalKategorie, string> = {
  earnings: 'Quartal',
  dividende: 'Dividende',
  insider: 'Insider',
  ma: 'M&A',
  guidance: 'Ausblick',
  produkt: 'Produkt',
  sonstiges: 'Sonstiges',
}

const KATEGORIE_VARIANT: Record<
  NewsTerminalKategorie,
  'positive' | 'negative' | 'neutral' | 'buy' | 'dividend'
> = {
  earnings: 'buy',
  dividende: 'dividend',
  insider: 'neutral',
  ma: 'neutral',
  guidance: 'buy',
  produkt: 'positive',
  sonstiges: 'neutral',
}

function formatZeit(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function UnternehmenChips({ zeile }: { zeile: NewsTerminalZeile }) {
  return (
    <div className="flex flex-wrap gap-1">
      {zeile.unternehmen.map((u) => {
        const href = u.isin
          ? fundamentaldatenHref({ isin: u.isin })
          : u.symbol
            ? fundamentaldatenHref({ symbol: u.symbol })
            : null
        const label = u.symbol ?? u.name.slice(0, 12)
        if (href) {
          return (
            <Link
              key={u.id}
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300 ring-1 ring-teal-500/20 hover:bg-teal-500/20"
            >
              {label}
            </Link>
          )
        }
        return (
          <span
            key={u.id}
            className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-text-muted)]"
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

export function PaNewsTerminal({
  paket,
  laden,
  nurHeute,
  kategorieFilter,
  onKategorieFilter,
}: {
  paket: NewsTerminalPaket | null
  laden: boolean
  nurHeute: boolean
  kategorieFilter: NewsTerminalKategorie | 'alle'
  onKategorieFilter: (k: NewsTerminalKategorie | 'alle') => void
}) {
  const zeilen = paket?.zeilen ?? []

  const kategorien = useMemo(() => {
    const counts = new Map<NewsTerminalKategorie, number>()
    for (const z of zeilen) {
      counts.set(z.kategorie, (counts.get(z.kategorie) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [zeilen])

  const gefiltert = useMemo(
    () => (kategorieFilter === 'alle' ? zeilen : zeilen.filter((z) => z.kategorie === kategorieFilter)),
    [zeilen, kategorieFilter],
  )

  const heuteCount = zeilen.filter((z) => z.istHeute).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onKategorieFilter('alle')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            kategorieFilter === 'alle'
              ? 'bg-teal-500/20 text-teal-200 ring-1 ring-teal-500/30'
              : 'bg-white/[0.03] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
          }`}
        >
          Alle ({zeilen.length})
        </button>
        {kategorien.map(([kat, count]) => (
          <button
            key={kat}
            type="button"
            onClick={() => onKategorieFilter(kat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              kategorieFilter === kat
                ? 'bg-teal-500/20 text-teal-200 ring-1 ring-teal-500/30'
                : 'bg-white/[0.03] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            {KATEGORIE_LABEL[kat]} ({count})
          </button>
        ))}
      </div>

      <PaCard variant="glass" className="border-[#1a1a1c] bg-[#080809]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] bg-[#0a0a0b] px-4 py-2.5 font-mono text-[11px] text-[var(--app-text-muted)]">
          <span>
            <span className="text-emerald-400/90">●</span> NEWS-TERMINAL
            {nurHeute ? (
              <span className="ml-2 text-[var(--app-text-muted)]">
                · Heute ({heuteCount})
              </span>
            ) : (
              <span className="ml-2 text-[var(--app-text-muted)]">· Letzte 48h</span>
            )}
          </span>
          <span>
            {paket?.unternehmen.length ?? 0} Unternehmen
            {paket?.aktualisiertAm ? (
              <span className="ml-2 hidden sm:inline">
                · {formatZeit(paket.aktualisiertAm)}
              </span>
            ) : null}
          </span>
        </div>

        {laden && zeilen.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[var(--app-text-muted)]">
            Meldungen werden geladen …
          </p>
        ) : gefiltert.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[var(--app-text-muted)]">
            {nurHeute
              ? 'Heute keine relevanten Meldungen für dein Portfolio.'
              : 'Keine aktuellen Meldungen für dein Portfolio.'}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {gefiltert.map((z, i) => (
              <li key={`${z.href}-${i}`}>
                <a
                  href={z.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
                >
                  <div className="w-14 shrink-0 pt-0.5 font-mono text-[10px] tabular-nums text-[var(--app-text-muted)]">
                    {formatZeit(z.veroeffentlichtAm)}
                    {z.istHeute ? (
                      <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wider text-emerald-400/80">
                        heute
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <UnternehmenChips zeile={z} />
                      <PaBadge variant={KATEGORIE_VARIANT[z.kategorie]}>
                        {KATEGORIE_LABEL[z.kategorie]}
                      </PaBadge>
                    </div>
                    <p className="text-sm font-medium leading-snug text-[var(--app-text)] group-hover:text-teal-100">
                      {z.titel}
                    </p>
                    {z.quelle ? (
                      <p className="mt-1 text-[10px] text-[var(--app-text-muted)]">{z.quelle}</p>
                    ) : null}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}

        {paket?.fehler ? (
          <p className="border-t border-amber-900/30 bg-amber-950/20 px-4 py-2 text-[11px] text-amber-200/80">
            Hinweis: {paket.fehler}
          </p>
        ) : null}
      </PaCard>
    </div>
  )
}
