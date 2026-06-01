'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  PaAreaChart,
  PaDrawdownChart,
  PaDividendBarChart,
  PaSignedBarChart,
} from '@/components/portfolio-analyse/parqet-charts'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaBadge, PaCard, PaIconTabs, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import { dividendenProMonat } from '@/lib/portfolio-analyse/auswertungen'
import {
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
} from '@/lib/portfolio-analyse/berechnung'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { berechneDrawdown, monatsrenditenProzent } from '@/lib/portfolio-analyse/zeitreihen'
import { BUCHUNGS_TYP_LABEL, type BuchungsTyp } from '@/lib/portfolio-analyse/types'

type ChartTab = 'wert' | 'performance' | 'drawdown' | 'dividenden'

const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: 'wert', label: 'Wertentwicklung' },
  { id: 'performance', label: 'Performance' },
  { id: 'drawdown', label: 'Drawdown' },
  { id: 'dividenden', label: 'Dividenden' },
]

function badgeVariant(typ: BuchungsTyp): 'buy' | 'sell' | 'dividend' | 'neutral' {
  if (typ === 'kauf') return 'buy'
  if (typ === 'verkauf') return 'sell'
  if (typ === 'dividende' || typ === 'zins') return 'dividend'
  return 'neutral'
}

export function PortfolioDashboardClient() {
  const { live, liveLaden, kursFehler, buchungen, meta, report, hatDaten, laden } = usePortfolioAnalyse()
  const [chartTab, setChartTab] = useState<ChartTab>('wert')

  const verlauf = live?.verlauf ?? []
  const k = live?.kennzahlen
  const positionen = live?.positionen ?? []

  const drawdown = useMemo(() => berechneDrawdown(verlauf), [verlauf])
  const monatsPerf = useMemo(
    () => monatsrenditenProzent(verlauf).map((p) => ({ label: p.label, wert: p.prozent })),
    [verlauf],
  )
  const divMonat = useMemo(() => dividendenProMonat(buchungen, 24), [buchungen])

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

  const startDatum = useMemo(() => {
    if (buchungen.length === 0) return null
    const min = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum
    return min ? formatDatumDe(min) : null
  }, [buchungen])

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
  const twr = report?.performance.twrTotalPercent

  return (
    <div className="space-y-6">
      <PaCard className="overflow-hidden">
        <div className="border-b border-zinc-800/60 px-4 pt-4 sm:px-6">
          <PaIconTabs tabs={CHART_TABS} active={chartTab} onChange={setChartTab} />
        </div>
        <div className="p-4 sm:p-6">
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

          {chartTab === 'wert' && <PaAreaChart punkte={verlauf} />}
          {chartTab === 'performance' && <PaSignedBarChart punkte={monatsPerf} yAxisProzent />}
          {chartTab === 'drawdown' && <PaDrawdownChart punkte={drawdown.serie} />}
          {chartTab === 'dividenden' && (
            <>
              <PaDividendBarChart punkte={divMonat.map((d) => ({ label: d.label, wert: d.wert }))} />
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
        <PaCard className="p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Rendite</h2>
          {startDatum ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">seit {startDatum} · in EUR</p>
          ) : null}
          <div className="mt-4 divide-y divide-zinc-800/60">
            <PaStatRow label="Portfoliowert" value={k ? formatEur(k.depotwertEur) : '—'} />
            <PaStatRow label="Investiert" value={k ? formatEur(k.einstandOffenEur) : '—'} />
            <PaStatRow
              label="IZF"
              value={irr != null ? formatProzent(irr) : '—'}
              badge={
                irr != null ? (
                  <PaBadge variant={irr >= 0 ? 'positive' : 'negative'}>
                    {irr >= 0 ? '+' : ''}
                    {irr.toFixed(2)} %
                  </PaBadge>
                ) : undefined
              }
            />
            <PaStatRow
              label="TWR (vereinfacht)"
              value={twr != null ? formatProzent(twr) : '—'}
              badge={
                twr != null ? (
                  <PaBadge variant={twr >= 0 ? 'positive' : 'negative'}>
                    {twr >= 0 ? '+' : ''}
                    {twr.toFixed(2)} %
                  </PaBadge>
                ) : undefined
              }
            />
            <PaStatRow
              label="Dividenden (brutto)"
              value={m ? formatEur(m.totalDividendsGrossEUR) : k ? formatEur(k.dividendenEur) : '—'}
            />
            <PaStatRow label="Steuern" value={m ? formatEur(m.totalTaxesEUR) : '—'} />
            <PaStatRow label="Gebühren" value={m ? formatEur(m.totalFeesEUR) : '—'} />
          </div>
          {kursFehler ? (
            <p className="mt-3 text-[11px] text-amber-500/90">Live-Kurse teilweise nicht verfügbar.</p>
          ) : null}
        </PaCard>

        <PaCard className="flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3">
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

        <PaCard className="flex flex-col">
          <div className="border-b border-zinc-800/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">Top Mover</h2>
            <p className="text-[11px] text-zinc-500">↑ Gewinner (live)</p>
          </div>
          <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
            {topMover.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-zinc-500">Keine Live-Performance.</li>
            ) : (
              topMover.map((p) => (
                <li key={p.isin ?? p.name} className="flex items-center gap-3 px-4 py-3">
                  <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{p.anzeigeName}</p>
                    <p className="text-[11px] text-zinc-500">{formatEur(p.wertLiveEur)}</p>
                  </div>
                  <PaBadge variant={(p.gewinnVerlustProzent ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {p.gewinnVerlustProzent != null ? formatProzent(p.gewinnVerlustProzent) : '—'}{' '}
                    {p.gewinnVerlustEur >= 0 ? '+' : ''}
                    {formatEur(p.gewinnVerlustEur)}
                  </PaBadge>
                </li>
              ))
            )}
          </ul>
        </PaCard>
      </div>

      {liveLaden ? (
        <p className="text-center text-[11px] text-zinc-600">Kurse werden aktualisiert …</p>
      ) : null}
    </div>
  )
}
