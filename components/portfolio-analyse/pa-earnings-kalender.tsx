'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  PaEarningsBerichtszeitBadge,
  PaEarningsTerminRow,
} from '@/components/portfolio-analyse/pa-earnings-termin-ui'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import {
  bevorzugterEarningsEintrag,
  type AnkuendigteEarningsErgebnis,
  type AnkuendigtesEarningsEintrag,
} from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  KALENDER_WOCHENTAGE,
  baueEarningsKalenderJahr,
  baueEarningsKalenderMonat,
  defaultEarningsMonatKey,
  verschiebeMonat,
} from '@/lib/portfolio-analyse/earnings-kalender-grid'
import { PaEarningsPrognosePanel } from '@/components/portfolio-analyse/pa-earnings-prognose-panel'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

type Ansicht = 'monat' | 'jahr'
type Layout = 'kalender' | 'liste'

function earningsEintragKey(e: AnkuendigtesEarningsEintrag): string {
  return `${e.isin ?? e.symbol}:${e.terminDatumIso}`
}

function KalenderTagZeile({
  e,
  aktiv,
  onSelect,
}: {
  e: AnkuendigtesEarningsEintrag
  aktiv: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full min-w-0 flex-col gap-1 rounded-lg border px-1.5 py-1.5 text-left transition ${
        aktiv
          ? 'border-[#eef0f1]/20 bg-[#121214]'
          : 'border-transparent hover:border-[#eef0f1]/10 hover:bg-[#0c0c0d]/80'
      }`}
    >
      <span className="truncate text-[11px] font-medium text-[#eef0f1]">{e.name}</span>
      <div className="flex flex-wrap items-center gap-1">
        <PaEarningsBerichtszeitBadge zeit={e.berichtszeit} size="mini" />
        {!e.bestaetigt ? <PaDividendEstimateBadge title="Geschätzt" /> : null}
      </div>
    </button>
  )
}

function ListenAnsicht({
  daten,
  meta,
  selectedKey,
  onSelect,
}: {
  daten: AnkuendigteEarningsErgebnis
  meta: Map<string, IsinMetadata>
  selectedKey: string | null
  onSelect: (e: AnkuendigtesEarningsEintrag) => void
}) {
  return (
    <div className="space-y-6">
      {daten.monate.map((monat) => (
        <section key={monat.monatKey}>
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">{monat.monatLabel}</h3>
            <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">
              {monat.anzahl} {monat.anzahl === 1 ? 'Termin' : 'Termine'}
            </p>
          </div>
          <ul className="space-y-2">
            {monat.eintraege.map((e) => {
              const key = earningsEintragKey(e)
              const aktiv = selectedKey === key
              return (
                <li key={key}>
                  <PaEarningsTerminRow
                    e={e}
                    meta={meta}
                    aktiv={aktiv}
                    onClick={() => onSelect(e)}
                    variant="liste"
                  />
                </li>
              )
            })}
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
  const [selected, setSelected] = useState<AnkuendigtesEarningsEintrag | null>(null)

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

  useEffect(() => {
    if (eintraege.length === 0) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (prev && eintraege.some((e) => earningsEintragKey(e) === earningsEintragKey(prev))) return prev
      return bevorzugterEarningsEintrag(eintraege, heute)
    })
  }, [eintragKey, eintraege, heute])

  const selectedKey = selected ? earningsEintragKey(selected) : null
  const jahr = Number(monatKey.slice(0, 4))
  const kalenderMonat = useMemo(() => baueEarningsKalenderMonat(monatKey, eintraege), [monatKey, eintraege])
  const kalenderJahr = useMemo(() => baueEarningsKalenderJahr(jahr, eintraege), [jahr, eintraege])

  if (laden) {
    return (
      <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">
        Kalender wird geladen …
        <span className="mt-2 block text-[11px] text-[var(--app-text-muted)]">
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
        <p className="text-sm text-[var(--app-text-muted)]">Keine Quartalstermine im Zeitraum.</p>
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
            className="rounded-lg border border-white/[0.08] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)]"
            aria-label="Vorheriger Monat"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setMonatKey((m) => verschiebeMonat(m, ansicht === 'jahr' ? 12 : 1))}
            className="rounded-lg border border-white/[0.08] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)]"
            aria-label="Nächster Monat"
          >
            ›
          </button>
        </div>

        <div className="flex rounded-lg border border-[#eef0f1]/[0.08] bg-[#0c0c0d] p-0.5">
          {(['monat', 'jahr'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAnsicht(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                ansicht === id
                  ? 'bg-[#eef0f1]/10 text-[#eef0f1] ring-1 ring-[#eef0f1]/15'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {id === 'monat' ? 'Monat' : 'Jahr'}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-[#eef0f1]/[0.08] bg-[#0c0c0d] p-0.5">
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
                  ? 'bg-[var(--app-surface-muted)]/90 text-[var(--app-text)] ring-1 ring-white/[0.06]'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <div className="min-w-0 space-y-5">
      {layout === 'liste' ? (
        <ListenAnsicht
          daten={daten}
          meta={meta}
          selectedKey={selectedKey}
          onSelect={setSelected}
        />
      ) : ansicht === 'jahr' ? (
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">{jahr}</h2>
            <p className="text-sm tabular-nums text-[var(--app-text-muted)]">
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
                className={`rounded-xl border p-4 text-left transition hover:border-teal-500/30 hover:bg-[var(--app-surface-muted)] ${
                  m.anzahl > 0
                    ? 'border-white/[0.08] bg-[var(--app-surface-muted)]'
                    : 'border-white/[0.04] bg-[var(--app-surface-muted)]/30 opacity-60'
                }`}
              >
                <p className="text-sm font-medium text-[var(--app-text)]">{m.titel}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-[var(--app-text)]">
                  {m.anzahl > 0 ? m.anzahl : '—'}
                </p>
                {m.anzahl > 0 ? (
                  <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
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
            <h2 className="text-lg font-semibold text-[var(--app-text)]">
              {kalenderMonat.titel}
              <span className="ml-2 text-sm font-normal text-[var(--app-text-muted)]">
                {kalenderMonat.anzahl} {kalenderMonat.anzahl === 1 ? 'Termin' : 'Termine'}
              </span>
            </h2>
          </div>

          <div className={`${appTableScrollClassName} rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]`}>
            <div className="min-w-[480px] sm:min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-white/[0.06] bg-[var(--app-surface-muted)]">
                {KALENDER_WOCHENTAGE.map((w) => (
                  <div
                    key={w}
                    className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]"
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
                        className={`flex min-h-[4.5rem] flex-col border-r border-[var(--app-border)] p-1 last:border-r-0 sm:min-h-[7rem] sm:p-1.5 md:min-h-[8.5rem] md:p-2 ${
                          tag.imMonat ? 'bg-[var(--app-surface-muted)]' : 'bg-[var(--app-surface)]/50'
                        }`}
                      >
                        <div className="mb-1 flex justify-end">
                          <span
                            className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] tabular-nums ${
                              istHeute
                                ? 'bg-violet-500/90 font-semibold text-white'
                                : tag.imMonat
                                  ? 'text-[var(--app-text-muted)]'
                                  : 'text-[var(--app-text-muted)]'
                            }`}
                          >
                            {String(tag.tag).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                          {tag.eintraege.map((e) => (
                            <KalenderTagZeile
                              key={earningsEintragKey(e)}
                              e={e}
                              aktiv={selectedKey === earningsEintragKey(e)}
                              onSelect={() => setSelected(e)}
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
        </div>

        <div className="lg:sticky lg:top-4">
          <PaEarningsPrognosePanel eintrag={selected} meta={meta} />
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-4 text-[11px] text-[var(--app-text-muted)]">
        <PaDividendEstimateBadge title="Geschätzt" />
        <span>Nächstes Quartal · DivvyDiary · Depot</span>
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
