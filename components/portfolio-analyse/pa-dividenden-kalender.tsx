'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import type { AnkuendigteDividendeEintrag, AnkuendigteDividendenErgebnis } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  KALENDER_WOCHENTAGE,
  baueKalenderJahr,
  baueKalenderMonat,
  defaultMonatKey,
  verschiebeMonat,
} from '@/lib/portfolio-analyse/dividenden-kalender-grid'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

type Ansicht = 'monat' | 'jahr'
type Layout = 'kalender' | 'liste'

function formatStueckTag(stueck: number): string {
  return `${stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })}x`
}

function KalenderTagZeile({
  e,
  meta,
  kompakt,
}: {
  e: AnkuendigteDividendeEintrag
  meta: Map<string, IsinMetadata>
  kompakt?: boolean
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${kompakt ? 'py-0.5' : ''}`}>
      <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--app-text)]">{e.name}</span>
      <span className="flex shrink-0 items-center gap-0.5 tabular-nums text-[11px] font-medium text-[var(--app-text)]">
        {formatEur(e.gesamtEur)}
        {!e.bestaetigt ? <PaDividendEstimateBadge title="Geschätzt" /> : null}
      </span>
    </div>
  )
}

function ListenAnsicht({
  daten,
  meta,
}: {
  daten: AnkuendigteDividendenErgebnis
  meta: Map<string, IsinMetadata>
}) {
  return (
    <div className="space-y-6">
      {daten.monate.map((monat) => (
        <section key={monat.monatKey}>
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--app-text-muted)]">{monat.monatLabel}</h3>
            <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{formatEur(monat.summeEur)}</p>
          </div>
          <ul className="space-y-3">
            {monat.eintraege.map((e) => (
              <li key={`${e.isin ?? e.symbol}-${e.zahlungsdatumIso}`} className="flex items-center gap-3">
                <PortfolioIsinLogo isin={e.isin} fallbackName={e.name} meta={meta} groesse="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--app-text)]">{e.name}</p>
                  <p className="text-[11px] text-[var(--app-text-muted)]">{formatDatumDe(e.zahlungsdatumIso)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{formatEur(e.gesamtEur)}</p>
                    {!e.bestaetigt ? <PaDividendEstimateBadge /> : null}
                  </div>
                  <div className="mt-1 flex justify-end gap-1.5">
                    <span className="rounded-md bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--app-text-muted)] ring-1 ring-white/[0.04]">
                      {formatStueckTag(e.stueck)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function PaDividendenKalender({
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
  const heute = heuteIsoUtc()
  const [monatKey, setMonatKey] = useState(heute.slice(0, 7))
  const [ansicht, setAnsicht] = useState<Ansicht>('monat')
  const [layout, setLayout] = useState<Layout>('kalender')

  const eintraege = daten?.eintraege ?? []
  const eintragKey = useMemo(
    () => eintraege.map((e) => `${e.isin}:${e.zahlungsdatumIso}`).join('|'),
    [daten?.eintraege],
  )

  useEffect(() => {
    if (!eintragKey) return
    setMonatKey((prev) => {
      if (eintraege.some((e) => e.zahlungsdatumIso.startsWith(prev))) return prev
      return defaultMonatKey(eintraege, heute)
    })
  }, [eintragKey, heute, eintraege])

  const jahr = Number(monatKey.slice(0, 4))

  const kalenderMonat = useMemo(
    () => baueKalenderMonat(monatKey, eintraege),
    [monatKey, eintraege],
  )
  const kalenderJahr = useMemo(() => baueKalenderJahr(jahr, eintraege), [jahr, eintraege])

  if (laden) {
    return <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">Kalender wird geladen …</p>
  }

  if (fehler) {
    return <p className="py-8 text-sm text-amber-400/90">{fehler}</p>
  }

  if (!daten || eintraege.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--app-text-muted)]">Keine angekündigten oder prognostizierten Dividenden im Zeitraum.</p>
        <Link href="/portfolioanalyse/dividenden" className="text-sm font-medium text-teal-400 hover:text-teal-300">
          ← Zurück zu Dividenden
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

        <div className="flex rounded-lg border border-white/[0.06] bg-[var(--app-surface-muted)] p-0.5">
          {(['monat', 'jahr'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAnsicht(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                ansicht === id
                  ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/25'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {id === 'monat' ? 'Monat' : 'Jahr'}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-white/[0.06] bg-[var(--app-surface-muted)] p-0.5">
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

      {layout === 'liste' ? (
        <ListenAnsicht daten={daten} meta={meta} />
      ) : ansicht === 'jahr' ? (
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">{jahr}</h2>
            <p className="text-sm tabular-nums text-[var(--app-text-muted)]">
              Summe:{' '}
              <span className="font-semibold text-[var(--app-text)]">
                {formatEur(kalenderJahr.reduce((s, m) => s + m.summeEur, 0))}
              </span>
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
                  {m.summeEur > 0 ? formatEur(m.summeEur) : '—'}
                </p>
                {m.anzahl > 0 ? (
                  <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
                    {m.anzahl} {m.anzahl === 1 ? 'Zahlung' : 'Zahlungen'}
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
                Summe:{' '}
                <span className="font-semibold tabular-nums text-[var(--app-text)]">
                  {formatEur(kalenderMonat.summeEur)}
                </span>
              </span>
            </h2>
          </div>

          <div className={`${appTableScrollClassName} rounded-xl border border-[var(--app-border)]`}>
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
                                ? 'bg-rose-500/90 font-semibold text-white'
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
                            <KalenderTagZeile key={`${e.isin}-${e.zahlungsdatumIso}`} e={e} meta={meta} kompakt />
                          ))}
                        </div>
                        {tag.summeEur > 0 ? (
                          <p className="mt-auto pt-1 text-right text-[10px] tabular-nums text-[var(--app-text-muted)]">
                            Summe: {formatEur(tag.summeEur)}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-4 text-[11px] text-[var(--app-text-muted)]">
        <PaDividendEstimateBadge title="Geschätzt" />
        <span>Prognose · Zahltag · max. 1 Jahr voraus · nur Depot-Positionen</span>
        <Link
          href="/portfolioanalyse/dividenden"
          className="ml-auto text-teal-400/90 hover:text-teal-300"
        >
          ← Dividenden-Dashboard
        </Link>
      </p>
    </div>
  )
}
