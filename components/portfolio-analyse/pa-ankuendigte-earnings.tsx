'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { PaEarningsTerminRow } from '@/components/portfolio-analyse/pa-earnings-termin-ui'
import { PaFundamentalQuickLink } from '@/components/portfolio-analyse/pa-fundamental-quick-link'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import type {
  AnkuendigteEarningsErgebnis,
  AnkuendigtesEarningsEintrag,
} from '@/lib/portfolio-analyse/ankuendigte-earnings'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const heuteMonat = heuteIsoUtc().slice(0, 7)

  useEffect(() => {
    if (!daten?.monate.length || !scrollRef.current) return
    const ziel =
      daten.monate.find((m) => m.monatKey >= heuteMonat)?.monatKey ??
      daten.monate[daten.monate.length - 1]?.monatKey
    if (!ziel) return
    const el = scrollRef.current.querySelector(`[data-monat="${ziel}"]`)
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [daten?.monate, heuteMonat])

  if (laden) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Quartalstermine werden geladen …
        <span className="mt-2 block text-[11px] text-zinc-600">
          DivvyDiary — eine Aktie nach der anderen (ca. 3–5 s pro Position).
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
    <div ref={scrollRef} className="max-h-[32rem] space-y-6 overflow-y-auto pr-1 scroll-smooth">
      {daten.monate.map((monat) => (
        <section key={monat.monatKey} data-monat={monat.monatKey}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {monat.monatLabel}
            </h3>
            <p className="text-xs tabular-nums text-zinc-400">
              {monat.anzahl} {monat.anzahl === 1 ? 'Termin' : 'Termine'}
            </p>
          </div>
          <ul className="space-y-2">
            {monat.eintraege.map((e) => {
              const key = eintragKey(e)
              const klickbar = Boolean(onSelect)
              const aktiv = selectedKey === key
              return (
                <li key={key}>
                  <PaEarningsTerminRow
                    e={e}
                    meta={meta}
                    aktiv={aktiv}
                    onClick={klickbar ? () => onSelect!(e) : undefined}
                    variant="liste"
                    trailing={
                      <div className="flex items-center gap-1.5">
                        <PaFundamentalQuickLink isin={e.isin} />
                        <span className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400 ring-1 ring-white/[0.05]">
                          {e.stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })}×
                        </span>
                      </div>
                    }
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="border-t border-[#eef0f1]/[0.06] pt-3 text-[10px] leading-relaxed text-zinc-600">
        <span className="inline-flex flex-wrap items-center gap-2">
          <PaDividendEstimateBadge title="Geschätzt" />
          <span>= Termin geschätzt.</span>
          <span className="text-zinc-500">Nächster Quartalstermin · DivvyDiary.</span>
        </span>
      </p>
      <Link
        href="/portfolioanalyse/earnings/kalender"
        className="block pt-1 text-sm font-medium text-[#eef0f1]/80 transition hover:text-[#eef0f1]"
      >
        Earnings-Kalender ansehen →
      </Link>
    </div>
  )
}
