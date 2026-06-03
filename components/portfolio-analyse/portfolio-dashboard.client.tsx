'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PaDrawdownChart } from '@/components/portfolio-analyse/parqet-charts'
import { PaGestapelteDividendenChart } from '@/components/portfolio-analyse/pa-dividenden-chart'
import { PaPerformanceChart } from '@/components/portfolio-analyse/pa-performance-chart'
import { PaWertentwicklungChart } from '@/components/portfolio-analyse/pa-wertentwicklung-chart'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaPortfolioHero } from '@/components/portfolio-analyse/pa-portfolio-hero'
import { PaWertpapiereListe } from '@/components/portfolio-analyse/pa-wertpapiere-liste'
import { PaBadge, PaCard, PaIconTabs, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import { dividendenGestapeltProMonat } from '@/lib/portfolio-analyse/dividenden-auswertung'
import {
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
} from '@/lib/portfolio-analyse/berechnung'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { depotwertVorBoersenbeginn } from '@/lib/portfolio-analyse/live-bewertung'
import { berechneParqetPeriodKennzahlen } from '@/lib/portfolio-analyse/parqet-period-kennzahlen'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'
import { PortfolioMetric } from '@/lib/portfolio-analyse/portfolio-metric'
import { usePortfolioBerechnungen } from '@/components/portfolio-analyse/use-portfolio-berechnungen'
import { BUCHUNGS_TYP_LABEL, type BuchungsTyp } from '@/lib/portfolio-analyse/types'
import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'

type ChartTab = 'wert' | 'performance' | 'drawdown' | 'dividenden'

const CHART_TABS: { id: ChartTab; label: string; shortLabel: string }[] = [
  { id: 'wert', label: 'Wertentwicklung', shortLabel: 'Wert' },
  { id: 'performance', label: '% Performance', shortLabel: 'Perf.' },
  { id: 'drawdown', label: 'Drawdown', shortLabel: 'Drawdown' },
  { id: 'dividenden', label: 'Dividenden', shortLabel: 'Div.' },
]

function badgeVariant(typ: BuchungsTyp): 'buy' | 'sell' | 'dividend' | 'neutral' {
  if (typ === 'kauf') return 'buy'
  if (typ === 'verkauf') return 'sell'
  if (typ === 'dividende' || typ === 'zins') return 'dividend'
  return 'neutral'
}

export function PortfolioDashboardClient() {
  const {
    live,
    liveLaden,
    wertentwicklung,
    wertentwicklungLaden,
    kursFehler,
    buchungen,
    meta,
    report,
    hatDaten,
    laden,
  } = usePortfolioAnalyse()
  const [chartTab, setChartTab] = useState<ChartTab>('wert')
  const [periodKey, setPeriodKey] = useState<PeriodPerformance['periodKey']>('MAX')
  const [perfMitDivRealisiert, setPerfMitDivRealisiert] = useState(true)
  const [portfolioMetric, setPortfolioMetric] = useState(PortfolioMetric.TTWROR)

  const k = live?.kennzahlen
  const positionen = live?.positionen ?? []

  const { wertentwicklung: wertTimeline, performance: performanceZeitreihe, drawdown } =
    usePortfolioBerechnungen(wertentwicklung, buchungen, {
      mitDivUndRealisiert: perfMitDivRealisiert,
      portfolioMetric,
    })
  const portfolioChartName = useMemo(() => {
    const klassen = new Set(positionen.map((p) => p.assetKlasse))
    if (klassen.size === 1 && klassen.has('aktie')) return 'Aktien Portfolio'
    return 'Portfolio'
  }, [positionen])
  const divSerie = useMemo(() => dividendenGestapeltProMonat(buchungen, meta), [buchungen, meta])

  const letzteAktivitaeten = useMemo(
    () => sortiereBuchungenNeuesteZuerst(buchungen).slice(0, 8),
    [buchungen],
  )

  const topMover = useMemo(
    () =>
      [...positionen]
        .filter((p) => p.gewinnVerlustProzent != null && p.hatLiveKurs)
        .sort((a, b) => (b.gewinnVerlustProzent ?? 0) - (a.gewinnVerlustProzent ?? 0))
        .slice(0, 6),
    [positionen],
  )

  const startDatumIso = useMemo(() => {
    if (buchungen.length === 0) return null
    return [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum ?? null
  }, [buchungen])

  const periodKennzahlen = useMemo(() => {
    if (!k || buchungen.length === 0) {
      return berechneParqetPeriodKennzahlen(periodKey, [], [], 0, startDatumIso)
    }
    const tagesstart =
      periodKey === '1T' && live?.positionen
        ? depotwertVorBoersenbeginn(buchungen, live.positionen, heuteIso())
        : null
    return berechneParqetPeriodKennzahlen(
      periodKey,
      buchungen,
      wertTimeline,
      k.depotwertEur,
      startDatumIso,
      tagesstart,
    )
  }, [buchungen, k, live?.positionen, periodKey, startDatumIso, wertTimeline])

  const startDatum = startDatumIso ? formatDatumDe(startDatumIso) : null

  if (laden && !live) {
    return <p className="py-16 text-center text-sm text-zinc-500">Portfolio wird geladen …</p>
  }

  if (!hatDaten) {
    return (
      <PaCard className="p-8 text-center">
        <p className="text-sm text-zinc-400">Noch keine Portfolio-Daten.</p>
        <Link
          href="/portfolioanalyse/import"
          className="mt-4 inline-block rounded-full bg-teal-600/80 px-5 py-2 text-sm font-medium text-white hover:bg-teal-600"
        >
          Daten importieren
        </Link>
      </PaCard>
    )
  }

  const m = report?.metrics
  const irr = report?.performance.irrAnnualizedPercent

  const gewinn = k?.gewinnVerlustEur
  const gewinnPct = k?.gewinnVerlustProzent

  return (
    <div className="space-y-5 sm:space-y-8">
      {k ? (
        <PaPortfolioHero
          positionen={positionen}
          kennzahlen={{
            depotwertEur: k.depotwertEur,
            investiertEur: k.investiertEur,
            gewinnVerlustProzent: k.gewinnVerlustProzent,
          }}
          metrics={m}
          irr={irr}
          periodKennzahlen={periodKennzahlen}
          onPeriodKeyChange={setPeriodKey}
        />
      ) : null}

      <PaCard variant="elevated" className="min-w-0 overflow-hidden">
        <div className="-mx-1 border-b border-white/[0.04] px-3 pt-3 sm:mx-0 sm:px-6 sm:pt-4">
          <PaIconTabs tabs={CHART_TABS} active={chartTab} onChange={setChartTab} />
        </div>
        <div className="min-w-0 p-3 sm:p-6">
          {chartTab === 'drawdown' && drawdown.maxDrawdownProzent < 0 ? (
            <div className="mb-4 flex flex-wrap justify-end gap-6 text-sm">
              <div>
                <p className="text-[11px] text-zinc-500">Maximaler Drawdown</p>
                <p className="font-semibold tabular-nums text-white">
                  {formatProzent(drawdown.maxDrawdownProzent)}
                </p>
              </div>
              {drawdown.maxDrawdownTage != null ? (
                <div>
                  <p className="text-[11px] text-zinc-500">Dauer</p>
                  <p className="font-semibold text-white">{drawdown.maxDrawdownTage} Tage</p>
                </div>
              ) : null}
              {drawdown.maxDrawdownPeriode ? (
                <div>
                  <p className="text-[11px] text-zinc-500">Periode</p>
                  <p className="font-semibold text-white">
                    {drawdown.maxDrawdownPeriode.vonLabel} – {drawdown.maxDrawdownPeriode.bisLabel}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {chartTab === 'wert' && (
            <PaWertentwicklungChart
              punkte={wertTimeline}
              laden={wertentwicklungLaden && wertentwicklung.length > 0}
              hoehe={220}
            />
          )}
          {chartTab === 'performance' && (
            <PaPerformanceChart
              punkte={performanceZeitreihe}
              portfolioName={portfolioChartName}
              portfolioMetric={portfolioMetric}
              onPortfolioMetricChange={setPortfolioMetric}
              laden={wertentwicklungLaden && wertentwicklung.length > 0}
              mitDivRealisiert={perfMitDivRealisiert}
              onMitDivRealisiertChange={setPerfMitDivRealisiert}
            />
          )}
          {chartTab === 'drawdown' && <PaDrawdownChart punkte={drawdown.serie} />}
          {chartTab === 'dividenden' && (
            <>
              <PaGestapelteDividendenChart
                daten={divSerie.monate}
                durchschnittIntervallEur={divSerie.durchschnittIntervallEur}
                hoehe={240}
              />
              <p className="mt-3 text-right text-xs text-zinc-500">
                Umfassendere Auswertungen auf dem{' '}
                <Link href="/portfolioanalyse/dividenden" className="text-teal-400 hover:underline">
                  Dividenden-Dashboard
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </PaCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <PaCard variant="elevated" className="p-5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-50">Kennzahlen</h2>
          {startDatum ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">seit {startDatum} · in EUR</p>
          ) : null}
          <div className="mt-4 divide-y divide-white/[0.04]">
            <PaStatRow label="Einstand (offen)" value={k ? formatEur(k.einstandOffenEur) : '—'} />
            <PaStatRow label="Netto eingezahlt" value={k ? formatEur(k.investiertEur) : '—'} />
            <PaStatRow
              label="Gewinn / Verlust"
              value={gewinn != null ? formatEur(gewinn) : '—'}
              badge={
                gewinnPct != null ? (
                  <PaBadge variant={gewinnPct >= 0 ? 'positive' : 'negative'}>
                    {formatProzent(gewinnPct)}
                  </PaBadge>
                ) : undefined
              }
            />
            <PaStatRow
              label="Dividenden (brutto)"
              value={m ? formatEur(m.totalDividendsGrossEUR) : k ? formatEur(k.dividendenEur) : '—'}
            />
            <PaStatRow
              label="Dividenden (netto)"
              value={m ? formatEur(m.totalDividendsNetEUR) : '—'}
            />
            <PaStatRow label="Steuern (gesamt)" value={m ? formatEur(m.totalTaxesEUR) : '—'} />
            <PaStatRow label="Gebühren" value={m ? formatEur(m.totalFeesEUR) : '—'} />
          </div>
          {kursFehler ? (
            <p className="mt-3 text-[11px] text-amber-500/90">Live-Kurse teilweise nicht verfügbar.</p>
          ) : null}
        </PaCard>

        <PaCard variant="elevated" className="flex flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">Letzte Aktivitäten</h2>
            <Link href="/portfolioanalyse/aktivitaeten" className="text-xs text-teal-400 hover:underline">
              Alle →
            </Link>
          </div>
          <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
            {letzteAktivitaeten.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <PortfolioIsinLogo isin={b.isin} fallbackName={b.wertpapierName} meta={meta} groesse="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    {anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)}
                  </p>
                  <p className="text-[11px] text-zinc-500">{formatDatumDe(b.datum)}</p>
                </div>
                <div className="text-right">
                  <PaBadge variant={badgeVariant(b.typ)}>{BUCHUNGS_TYP_LABEL[b.typ]}</PaBadge>
                  <p className="mt-1 text-sm tabular-nums text-zinc-100">{formatEur(b.betragEur)}</p>
                </div>
              </li>
            ))}
          </ul>
        </PaCard>

        <PaCard variant="elevated" className="flex flex-col">
          <div className="border-b border-white/[0.04] px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">Top Mover</h2>
            <p className="text-[11px] text-zinc-500">↑ Gewinner (live)</p>
          </div>
          <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
            {topMover.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-zinc-500">Keine Live-Performance.</li>
            ) : (
              topMover.map((p) => (
                <li key={p.isin ?? p.name} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{p.anzeigeName}</p>
                      <p className="text-[11px] text-zinc-500">{formatEur(p.wertLiveEur)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 self-start sm:self-center">
                    <PaBadge variant={(p.gewinnVerlustProzent ?? 0) >= 0 ? 'positive' : 'negative'}>
                      {p.gewinnVerlustProzent != null ? formatProzent(p.gewinnVerlustProzent) : '—'}{' '}
                      {p.gewinnVerlustEur >= 0 ? '+' : ''}
                      {formatEur(p.gewinnVerlustEur)}
                    </PaBadge>
                  </div>
                </li>
              ))
            )}
          </ul>
        </PaCard>
      </div>

      <PaWertpapiereListe
        positionen={positionen}
        buchungen={buchungen}
        meta={meta}
        laden={liveLaden}
      />

      {liveLaden ? (
        <p className="text-center text-[11px] text-zinc-600">Kurse werden aktualisiert …</p>
      ) : null}
    </div>
  )
}
