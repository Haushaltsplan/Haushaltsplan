'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'
import type { AnkuendigteEarningsErgebnis, AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  KALENDER_WOCHENTAGE,
  baueEarningsKalenderJahr,
  baueEarningsKalenderMonat,
  defaultEarningsMonatKey,
  verschiebeMonat,
} from '@/lib/portfolio-analyse/earnings-kalender-grid'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

type Ansicht = 'monat' | 'jahr'
type Layout = 'kalender' | 'liste'

function KalenderTagZeile({
  e,
  meta,
}: {
  e: AnkuendigtesEarningsEintrag
  meta: Map<string, IsinMetadata>
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 py-0.5">
      <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">{e.name}</span>
      {!e.bestaetigt ? <PaDividendEstimateBadge title="Geschätzt" /> : null}
    </div>
  )
}

function ListenAnsicht({
  daten,
  meta,
}: {
  daten: AnkuendigteEarningsErgebnis
  meta: Map<string, IsinMetadata>
}) {
  return (
    <div className="space-y-6">
      {daten.monate.map((monat) => (
        <section key={monat.monatKey}>
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{monat.monatLabel}</h3>
            <p className="text-sm font-semibold tabular-nums text-zinc-100">
              {monat.anzahl} {monat.anzahl === 1 ? 'Termin' : 'Termine'}
            </p>
          </div>
          <ul className="space-y-3">
            {monat.eintraege.map((e) => (
              <li key={`${e.isin ?? e.symbol}-${e.terminDatumIso}`} className="flex items-center gap-3">
                <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{e.name}</p>
                  <p className="text-[11px] text-zinc-500">{formatDatumDe(e.terminDatumIso)}</p>
                </div>
                {!e.bestaetigt ? <PaDividendEstimateBadge title="Geschätzt" /> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function PaEarningsKalender({
  daten,
  meta,
  laden,
  fehler,
}: {
  daten: AnkuendigteEarningsErgebnis | null
  meta: Map<string, IsinMetadata>
  laden: boolean
  fehler: string | null
}) {
  const heute = heuteIsoUtc()
  const [monatKey, setMonatKey] = useState(heute.slice(0, 7))
  const [ansicht, setAnsicht] = useState<Ansicht>('monat')
  const [layout, setLayout] = useState<Layout>('kalender')

  const eintraege = daten?.eintraege ?? []
  const eintragKey = useMemo(
    () => eintraege.map((e) => `${e.isin}:${e.terminDatumIso}`).join('|'),
    [daten?.eintraege],
  )

  useEffect(() => {
    if (!eintragKey) return
    setMonatKey((prev) => {
      if (eintraege.some((e) => e.terminDatumIso.startsWith(prev))) return prev
      return defaultEarningsMonatKey(eintraege, heute)
    })
  }, [eintragKey, heute, eintraege])

  const jahr = Number(monatKey.slice(0, 4))
  const kalenderMonat = useMemo(() => baueEarningsKalenderMonat(monatKey, eintraege), [monatKey, eintraege])
  const kalenderJahr = useMemo(() => baueEarningsKalenderJahr(jahr, eintraege), [jahr, eintraege])

  if (laden) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Kalender wird geladen …
        <span className="mt-2 block text-[11px] text-zinc-600">
          DivvyDiary-Abruf läuft (ca. 3–5 s pro Aktie).
        </span>
      </p>
    )
  }

  if (fehler) {
    return <p className="py-8 text-sm text-amber-400/90">{fehler}</p>
  }

  if (!daten || eintraege.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">Keine Quartalstermine im Zeitraum.</p>
        <Link href="/portfolioanalyse/earnings" className="text-sm font-medium text-teal-400 hover:text-teal-300">
          ← Zurück zu Quartalszahlen
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonatKey((m) => verschiebeMonat(m, ansicht === 'jahr' ? -12 : -1))}
            className="rounded-lg border border-white/[0.08] bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            aria-label="Vorheriger Monat"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setMonatKey((m) => verschiebeMonat(m, ansicht === 'jahr' ? 12 : 1))}
            className="rounded-lg border border-white/[0.08] bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            aria-label="Nächster Monat"
          >
            ›
          </button>
        </div>

        <div className="flex rounded-lg border border-white/[0.06] bg-zinc-950/80 p-0.5">
          {(['monat', 'jahr'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAnsicht(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                ansicht === id
                  ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/25'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {id === 'monat' ? 'Monat' : 'Jahr'}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-white/[0.06] bg-zinc-950/80 p-0.5">
          {(
            [
              { id: 'kalender' as const, label: 'Kalender' },
              { id: 'liste' as const, label: 'Liste' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayout(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                layout === id
                  ? 'bg-zinc-800/90 text-zinc-200 ring-1 ring-white/[0.06]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {layout === 'liste' ? (
        <ListenAnsicht daten={daten} meta={meta} />
      ) : ansicht === 'jahr' ? (
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">{jahr}</h2>
            <p className="text-sm tabular-nums text-zinc-400">
              {kalenderJahr.reduce((s, m) => s + m.anzahl, 0)} Termine
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kalenderJahr.map((m) => (
              <button
                key={m.monatKey}
                type="button"
                onClick={() => {
                  setMonatKey(m.monatKey)
                  setAnsicht('monat')
                }}
                className={`rounded-xl border p-4 text-left transition hover:border-teal-500/30 hover:bg-zinc-900/80 ${
                  m.anzahl > 0
                    ? 'border-white/[0.08] bg-zinc-950/60'
                    : 'border-white/[0.04] bg-zinc-950/30 opacity-60'
                }`}
              >
                <p className="text-sm font-medium text-zinc-200">{m.titel}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-50">
                  {m.anzahl > 0 ? m.anzahl : '—'}
                </p>
                {m.anzahl > 0 ? (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {m.anzahl === 1 ? 'Termin' : 'Termine'}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">
              {kalenderMonat.titel}
              <span className="ml-2 text-sm font-normal text-zinc-500">
                {kalenderMonat.anzahl} {kalenderMonat.anzahl === 1 ? 'Termin' : 'Termine'}
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-white/[0.06] bg-zinc-900/50">
                {KALENDER_WOCHENTAGE.map((w) => (
                  <div
                    key={w}
                    className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {w}
                  </div>
                ))}
              </div>
              {kalenderMonat.wochen.map((woche, wi) => (
                <div key={wi} className="grid grid-cols-7 border-t border-white/[0.04] first:border-t-0">
                  {woche.map((tag) => {
                    const istHeute = tag.iso === heute
                    return (
                      <div
                        key={tag.iso}
                        className={`flex min-h-[7.5rem] flex-col border-r border-white/[0.04] p-1.5 last:border-r-0 sm:min-h-[8.5rem] sm:p-2 ${
                          tag.imMonat ? 'bg-zinc-950/40' : 'bg-zinc-950/20'
                        }`}
                      >
                        <div className="mb-1 flex justify-end">
                          <span
                            className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] tabular-nums ${
                              istHeute
                                ? 'bg-violet-500/90 font-semibold text-white'
                                : tag.imMonat
                                  ? 'text-zinc-400'
                                  : 'text-zinc-600'
                            }`}
                          >
                            {String(tag.tag).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                          {tag.eintraege.map((e) => (
                            <KalenderTagZeile
                              key={`${e.isin}-${e.terminDatumIso}`}
                              e={e}
                              meta={meta}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-4 text-[11px] text-zinc-600">
        <PaDividendEstimateBadge title="Geschätzt" />
        <span>DivvyDiary-Scrape · max. 1 Jahr voraus · nur Depot-Positionen</span>
        <Link
          href="/portfolioanalyse/earnings"
          className="ml-auto text-teal-400/90 hover:text-teal-300"
        >
          ← Quartalszahlen
        </Link>
      </p>
    </div>
  )
}
