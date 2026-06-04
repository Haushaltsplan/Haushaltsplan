'use client'

import { useEffect, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaEarningsBerichtszeitBadge } from '@/components/portfolio-analyse/pa-earnings-termin-ui'
import { PaDividendEstimateBadge } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe } from '@/lib/portfolio-analyse/berechnung'
import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import type { EarningsKennzahlPrognose } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import { ladeEarningsSchaetzungenFuerEintrag } from '@/lib/portfolio-analyse/earnings-schaetzungen-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

function quelleLabel(quelle: EarningsSchaetzungen['quelle']): string {
  switch (quelle) {
    case 'yahoo':
      return 'Yahoo Finance'
    case 'wallstreet':
      return 'Wallstreet-online'
    case 'finnhub':
      return 'Finnhub'
    default:
      return 'Kombiniert'
  }
}

function WachstumChip({ k }: { k: EarningsKennzahlPrognose }) {
  const w = k.wachstumProzent
  if (w == null) {
    return (
      <span className="rounded-full border border-dashed border-zinc-600/70 px-2 py-0.5 text-[10px] text-zinc-500">
        Vergleich n/a
      </span>
    )
  }
  const positiv = w >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        positiv
          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25'
          : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/25'
      }`}
      title={k.vergleichLabel ?? undefined}
    >
      <span aria-hidden>{positiv ? '▲' : '▼'}</span>
      {k.wachstumAnzeige ?? `${w.toFixed(1)} %`}
    </span>
  )
}

function KennzahlHero({
  k,
  gross = false,
}: {
  k: EarningsKennzahlPrognose
  gross?: boolean
}) {
  const spanne =
    k.spanne.low != null && k.spanne.high != null
      ? `${k.spanne.low.toLocaleString('de-DE', { maximumFractionDigits: 2 })} – ${k.spanne.high.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`
      : null

  return (
    <article
      className={`rounded-xl border border-[#eef0f1]/[0.08] bg-[#0a0a0b] p-3.5 ${
        gross ? 'sm:col-span-1' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{k.label}</p>
        <WachstumChip k={k} />
      </div>
      <p
        className={`mt-2 font-semibold tabular-nums tracking-tight text-[#eef0f1] ${
          gross ? 'text-2xl' : 'text-xl'
        }`}
      >
        {k.spanne.averageAnzeige ?? '—'}
      </p>
      {k.vorjahrAnzeige != null ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          Vorjahr: <span className="tabular-nums text-zinc-400">{k.vorjahrAnzeige}</span>
          {k.vergleichLabel ? <span className="text-zinc-600"> · {k.vergleichLabel}</span> : null}
        </p>
      ) : k.vergleichLabel ? (
        <p className="mt-1 text-[11px] text-zinc-600">{k.vergleichLabel}</p>
      ) : null}
      {spanne ? <p className="mt-1 text-[10px] tabular-nums text-zinc-600">Spanne {spanne}</p> : null}
    </article>
  )
}

function KennzahlKlein({ k }: { k: EarningsKennzahlPrognose }) {
  return (
    <div className="rounded-lg border border-[#eef0f1]/[0.06] bg-[#0a0a0b]/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-zinc-500">{k.label}</p>
        <WachstumChip k={k} />
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
        {k.spanne.averageAnzeige ?? '—'}
      </p>
      {k.vorjahrAnzeige ? (
        <p className="text-[10px] text-zinc-600">Vorjahr {k.vorjahrAnzeige}</p>
      ) : null}
    </div>
  )
}

export function PaEarningsPrognosePanel({
  eintrag,
  meta,
}: {
  eintrag: AnkuendigtesEarningsEintrag | null
  meta: Map<string, IsinMetadata>
}) {
  const [daten, setDaten] = useState<EarningsSchaetzungen | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const key = eintrag ? `${eintrag.isin}:${eintrag.terminDatumIso}` : ''

  useEffect(() => {
    if (!eintrag) {
      setDaten(null)
      setFehler(null)
      return
    }
    const eintragFix = eintrag
    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      setDaten(null)
      try {
        const res = await ladeEarningsSchaetzungenFuerEintrag(eintragFix, meta)
        if (!cancelled) setDaten(res)
      } catch (e) {
        if (!cancelled) {
          setDaten(null)
          setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [key, eintrag, meta])

  if (!eintrag) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-xl border border-dashed border-[#eef0f1]/10 bg-[#0c0c0d] px-6 text-center">
        <p className="text-sm text-zinc-400">Klicke auf einen Termin für Konsens-Prognosen.</p>
        <p className="mt-2 text-[11px] text-zinc-600">
          Wachstum vs. Vorjahresquartal (Yahoo/Finnhub) · weitere Kennzahlen (Wallstreet)
        </p>
      </div>
    )
  }

  const haupt = daten?.kennzahlen ?? []
  const weitere = daten?.weitereKennzahlen ?? []
  const hatWachstum = [...haupt, ...weitere].some((k) => k.wachstumProzent != null)

  return (
    <div className="flex h-full min-h-[16rem] flex-col rounded-xl border border-[#eef0f1]/[0.08] bg-[#0c0c0d]">
      <div className="border-b border-[#eef0f1]/[0.06] px-4 py-3">
        <div className="flex items-start gap-3">
          <PortfolioIsinLogo isin={eintrag.isin} fallbackName={eintrag.name} meta={meta} groesse="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#eef0f1]">{eintrag.name}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Termin {formatDatumDe(eintrag.terminDatumIso)}</p>
            {daten?.prognosePeriode ? (
              <p className="mt-0.5 text-[11px] font-medium text-zinc-400">{daten.prognosePeriode}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PaEarningsBerichtszeitBadge zeit={eintrag.berichtszeit} />
              {!eintrag.bestaetigt ? <PaDividendEstimateBadge title="Geschätzter Termin" /> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {laden ? (
          <p className="py-8 text-center text-sm text-zinc-500">Prognosen werden geladen …</p>
        ) : fehler ? (
          <p className="py-6 text-sm text-amber-400/90">{fehler}</p>
        ) : !daten ? (
          <p className="py-6 text-sm text-zinc-500">
            Keine Konsens-Daten verfügbar. Für EU-Titel oft nur über Wallstreet (Jahresschätzung).
          </p>
        ) : (
          <div className="space-y-4">
            {hatWachstum ? (
              <p className="text-[10px] leading-relaxed text-zinc-600">
                Erwartetes Wachstum laut Konsens gegenüber dem Vorjahresquartal bzw. Geschäftsjahr — ähnlich
                wie bei Quartr.
              </p>
            ) : (
              <p className="text-[10px] leading-relaxed text-amber-500/80">
                Für diese Aktie liegt kein Quartals-Vergleich vor; unten ggf. Jahres-Kennzahlen (Wallstreet).
              </p>
            )}

            {haupt.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {haupt.map((k) => (
                  <KennzahlHero key={k.schluessel} k={k} gross={k.schluessel === 'eps' || k.schluessel === 'umsatz'} />
                ))}
              </div>
            ) : null}

            {weitere.length > 0 ? (
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Weitere Kennzahlen
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {weitere.map((k) => (
                    <KennzahlKlein key={`${k.schluessel}-${k.label}`} k={k} />
                  ))}
                </div>
              </section>
            ) : null}

            <p className="text-[10px] text-zinc-600">
              Segment-Prognosen sind in kostenlosen APIs kaum verfügbar; dafür wäre ein eigener Scraper
              (z. B. IR-Seiten, Factset-Alternativen) nötig.
            </p>
          </div>
        )}
      </div>

      <p className="border-t border-[#eef0f1]/[0.06] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-600">
        {daten
          ? `Quellen: ${quelleLabel(daten.quelle)} · EPS/Umsatz-Trend Yahoo · Quartalsvergleich Finnhub · Kennzahlen Wallstreet-Scrape`
          : 'Daten werden beim Klick nachgeladen.'}
      </p>
    </div>
  )
}
