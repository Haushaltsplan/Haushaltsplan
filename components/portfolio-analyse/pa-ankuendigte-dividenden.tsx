'use client'

import Link from 'next/link'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { AnkuendigteDividendenErgebnis } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

function formatStueckTag(stueck: number): string {
  const s = stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })
  return `${s}x`
}

function formatDivProStueck(eur: number): string {
  return eur.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function PaAnkuendigteDividenden({
  daten,
  meta,
  laden,
  fehler,
}: {
  daten: AnkuendigteDividendenErgebnis | null
  meta: Map<string, IsinMetadata>
  laden: boolean
  fehler: string | null
}) {
  if (laden) {
    return <p className="py-8 text-center text-sm text-zinc-500">Ankündigungen werden geladen …</p>
  }

  if (fehler) {
    return <p className="py-6 text-sm text-amber-400/90">{fehler}</p>
  }

  if (!daten || daten.monate.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">
          Keine angekündigten Dividenden für deine Depot-Positionen gefunden.
        </p>
        {daten?.hinweise.map((h) => (
          <p key={h} className="text-[11px] leading-relaxed text-zinc-600">
            {h}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="max-h-[28rem] space-y-5 overflow-y-auto pr-1">
      {daten.monate.map((monat) => (
        <section key={monat.monatKey}>
          <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              {monat.monatLabel}
            </h3>
            <p className="text-sm font-semibold tabular-nums text-zinc-100">{formatEur(monat.summeEur)}</p>
          </div>
          <ul className="space-y-3">
            {monat.eintraege.map((e) => (
              <li key={`${e.isin ?? e.symbol}-${e.zahlungsdatumIso}`} className="flex items-center gap-3">
                <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{e.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {formatDatumDe(e.zahlungsdatumIso)}
                    {e.bestaetigt
                      ? ' · angekündigt'
                      : e.quelle === 'finnhub'
                        ? ' · Finnhub'
                        : e.quelle === 'yahoo'
                          ? ' · Yahoo'
                          : null}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <p className="text-sm font-semibold tabular-nums text-zinc-50">{formatEur(e.gesamtEur)}</p>
                    {!e.bestaetigt ? <PaDividendEstimateBadge /> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
                    <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400 ring-1 ring-white/[0.04]">
                      {formatStueckTag(e.stueck)}
                    </span>
                    <span className="text-[10px] tabular-nums text-zinc-500">
                      {formatDivProStueck(e.dividendeProStueckEur)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="border-t border-white/[0.04] pt-3 text-[10px] leading-relaxed text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <PaDividendEstimateBadge title="Geschätzt" />
          <span>= Prognose aus Historie und Wachstum (ersetzt bei offiziellem Termin).</span>
        </span>{' '}
        Angekündigte Termine ohne E. Max. 1 Jahr voraus.
      </p>
      <Link
        href="/portfolioanalyse/dividenden/kalender"
        className="block pt-2 text-sm font-medium text-teal-400 transition hover:text-teal-300"
      >
        Dividendenkalender ansehen →
      </Link>
    </div>
  )
}
