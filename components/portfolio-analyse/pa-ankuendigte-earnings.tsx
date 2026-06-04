'use client'

import Link from 'next/link'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'
import type {
  AnkuendigteEarningsErgebnis,
  AnkuendigtesEarningsEintrag,
} from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { earningsTerminUnterzeile } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

function formatStueckTag(stueck: number): string {
  return `${stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })}x`
}

function eintragKey(e: { isin: string | null; symbol: string; terminDatumIso: string }): string {
  return `${e.isin ?? e.symbol}:${e.terminDatumIso}`
}

export function PaAnkuendigteEarnings({
  daten,
  meta,
  laden,
  fehler,
  selectedKey,
  onSelect,
}: {
  daten: AnkuendigteEarningsErgebnis | null
  meta: Map<string, IsinMetadata>
  laden: boolean
  fehler: string | null
  selectedKey?: string | null
  onSelect?: (e: AnkuendigtesEarningsEintrag) => void
}) {
  if (laden) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Quartalstermine werden geladen …
        <span className="mt-2 block text-[11px] text-zinc-600">
          Erster Abruf: ca. 3–5 Sekunden pro Aktie (nacheinander).
        </span>
      </p>
    )
  }

  if (fehler) {
    return <p className="py-6 text-sm text-amber-400/90">{fehler}</p>
  }

  if (!daten || daten.monate.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">
          Keine Quartalstermine für deine Depot-Positionen gefunden.
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
            <p className="text-sm font-semibold tabular-nums text-zinc-100">
              {monat.anzahl} {monat.anzahl === 1 ? 'Termin' : 'Termine'}
            </p>
          </div>
          <ul className="space-y-3">
            {monat.eintraege.map((e) => {
              const key = eintragKey(e)
              const klickbar = Boolean(onSelect)
              const aktiv = selectedKey === key
              const inhalt = (
                <>
                  <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">{e.name}</p>
                    <p className="text-[11px] text-zinc-500">{earningsTerminUnterzeile(e)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!e.bestaetigt ? <PaDividendEstimateBadge title="Geschätzter Termin" /> : null}
                      <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400 ring-1 ring-white/[0.04]">
                        {formatStueckTag(e.stueck)}
                      </span>
                    </div>
                  </div>
                </>
              )
              return (
                <li key={key}>
                  {klickbar ? (
                    <button
                      type="button"
                      onClick={() => onSelect!(e)}
                      className={`flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition ${
                        aktiv ? 'bg-violet-500/15 ring-1 ring-violet-500/30' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {inhalt}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">{inhalt}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="border-t border-white/[0.04] pt-3 text-[10px] leading-relaxed text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <PaDividendEstimateBadge title="Geschätzt" />
          <span>= Schätzung aus letztem Termin + Melde-Rhythmus.</span>
        </span>{' '}
        Max. 1 Jahr voraus · Quelle DivvyDiary.
      </p>
      <Link
        href="/portfolioanalyse/earnings/kalender"
        className="block pt-2 text-sm font-medium text-teal-400 transition hover:text-teal-300"
      >
        Earnings-Kalender ansehen →
      </Link>
    </div>
  )
}
