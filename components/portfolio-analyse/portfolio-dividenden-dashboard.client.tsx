'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PaGestapelteDividendenChart } from '@/components/portfolio-analyse/pa-dividenden-chart'
import { PaDividendenHeatmapGrid } from '@/components/portfolio-analyse/pa-dividenden-heatmap'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaBadge, PaCard, PaIconTabs, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import { dividendenKalender } from '@/lib/portfolio-analyse/auswertungen'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import {
  berechneDividendenHeatmap,
  berechneDividendenKpis,
  dividendenGestapeltProMonat,
  dividendenProJahrMitVergleich,
} from '@/lib/portfolio-analyse/dividenden-auswertung'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'

type DivChartTab = 'monatlich' | 'heatmap'

export function PortfolioDividendenDashboardClient() {
  const { buchungen, live, report, meta, hatDaten, laden } = usePortfolioAnalyse()
  const [chartTab, setChartTab] = useState<DivChartTab>('monatlich')

  const k = live?.kennzahlen
  const kpis = useMemo(() => {
    if (!k) return null
    const base = berechneDividendenKpis(buchungen, k.depotwertEur, k.einstandOffenEur)
    if (report?.metrics) {
      return {
        ...base,
        dividendenBruttoEur: report.metrics.totalDividendsGrossEUR,
        dividendenNettoEur: report.metrics.totalDividendsNetEUR,
        persoenlicheRenditeProzent:
          report.dividends.portfolioYieldOnCostGrossPercent ?? base.persoenlicheRenditeProzent,
      }
    }
    return base
  }, [buchungen, k, report])

  const gestapelt = useMemo(() => dividendenGestapeltProMonat(buchungen), [buchungen])
  const heatmap = useMemo(() => berechneDividendenHeatmap(buchungen), [buchungen])
  const jahresVergleich = useMemo(() => dividendenProJahrMitVergleich(buchungen), [buchungen])
  const letzteDivs = useMemo(() => dividendenKalender(buchungen).slice(0, 10), [buchungen])

  const startLabel = kpis?.startDatum ? formatDatumDe(kpis.startDatum) : null

  return (
    <PortfolioAnalyseShell
      title="Dividenden Dashboard"
      description="Erhaltene Dividenden, persönliche Dividenden-Rendite und Verlauf."
    >
      {!laden && !hatDaten ? null : (
        <div className="min-w-0 space-y-5 sm:space-y-8">
            {!hatDaten ? (
              <p className="text-sm text-zinc-500">
                <Link href="/portfolioanalyse/import" className="text-teal-400 hover:underline">
                  Daten importieren
                </Link>
              </p>
            ) : !kpis ? (
              <p className="py-12 text-center text-sm text-zinc-500">Lade …</p>
            ) : (
              <div className="space-y-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  <PaCard variant="elevated" className="p-5">
                    <p className="text-xs text-zinc-500">Portfoliowert</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                      {formatEur(kpis.depotwertEur)}
                    </p>
                    {startLabel ? (
                      <p className="mt-1 text-[11px] text-zinc-600">
                        Start {startLabel} · Investiert {formatEur(kpis.investiertEur)}
                      </p>
                    ) : null}
                  </PaCard>
                  <PaCard variant="elevated" className="p-5">
                    <p className="text-xs text-zinc-500">Erhaltene Dividenden</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">
                      {formatEur(kpis.dividendenBruttoEur)}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      TTM {formatEur(kpis.jahreseinkommenTtmEur)} · Ø mtl.{' '}
                      {formatEur(kpis.monatlichDurchschnittTtmEur)}
                    </p>
                  </PaCard>
                  <PaCard variant="elevated" className="p-5">
                    <p className="text-xs text-zinc-500">Pers. Div-Rendite (TTM)</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                      {kpis.persoenlicheRenditeProzent != null
                        ? `${kpis.persoenlicheRenditeProzent.toLocaleString('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} %`
                        : '—'}
                    </p>
                  </PaCard>
                </div>

                <PaCard variant="elevated" className="overflow-hidden">
                  <div className="border-b border-zinc-800/60 px-4 pt-4">
                    <PaIconTabs
                      tabs={[
                        { id: 'monatlich' as const, label: 'Monatlich' },
                        { id: 'heatmap' as const, label: 'Heatmap' },
                      ]}
                      active={chartTab}
                      onChange={setChartTab}
                    />
                  </div>
                  <div className="p-4 sm:p-6">
                    {chartTab === 'monatlich' ? (
                      <PaGestapelteDividendenChart
                        daten={gestapelt}
                        ttmLinie={kpis.monatlichDurchschnittTtmEur}
                      />
                    ) : (
                      <PaDividendenHeatmapGrid heatmap={heatmap} />
                    )}
                  </div>
                </PaCard>

                <div className="grid gap-6 lg:grid-cols-3">
                  <PaCard variant="elevated" className="p-5">
                    <h2 className="text-sm font-semibold text-zinc-100">Rendite</h2>
                    {startLabel ? (
                      <p className="mt-0.5 text-[11px] text-zinc-500">seit {startLabel}</p>
                    ) : null}
                    <div className="mt-4 divide-y divide-zinc-800/60">
                      <PaStatRow label="Brutto Dividende" value={formatEur(kpis.dividendenBruttoEur)} />
                      <PaStatRow label="Netto Dividende" value={formatEur(kpis.dividendenNettoEur)} />
                      <PaStatRow label="1 Jahr (TTM)" value={formatEur(kpis.jahreseinkommenTtmEur)} />
                      <PaStatRow label="Ø mtl. (TTM)" value={formatEur(kpis.monatlichDurchschnittTtmEur)} />
                    </div>
                    <div className="mt-4 border-t border-zinc-800/60 pt-3">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Pro Jahr
                      </p>
                      <ul className="space-y-2">
                        {jahresVergleich.map((j) => (
                          <li key={j.jahr} className="flex justify-between gap-2 text-sm">
                            <span className="text-zinc-400">{j.jahr}</span>
                            <span className="flex items-center gap-2">
                              <span className="tabular-nums text-zinc-200">{formatEur(j.betragEur)}</span>
                              {j.vsVorjahrProzent != null ? (
                                <PaBadge variant={j.vsVorjahrProzent >= 0 ? 'positive' : 'negative'}>
                                  {j.vsVorjahrProzent >= 0 ? '↑' : '↓'}{' '}
                                  {Math.abs(j.vsVorjahrProzent).toFixed(2)} %
                                </PaBadge>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </PaCard>

                  <PaCard variant="elevated" className="p-5">
                    <h2 className="text-sm font-semibold text-zinc-100">Angekündigte Dividenden</h2>
                    <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                      Ex-Dates und Prognosen sind ohne externe Dividenden-Daten nicht verfügbar. Nach Import neuer
                      Buchungen erscheinen gezahlte Beträge unter „Letzte Auszahlungen“.
                    </p>
                  </PaCard>

                  <PaCard className="flex flex-col">
                    <div className="border-b border-zinc-800/60 px-5 py-3">
                      <h2 className="text-sm font-semibold text-zinc-100">Letzte Auszahlungen</h2>
                    </div>
                    <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
                      {letzteDivs.length === 0 ? (
                        <li className="px-5 py-8 text-center text-sm text-zinc-500">Keine Dividenden.</li>
                      ) : (
                        letzteDivs.map((d, i) => (
                          <li key={`${d.datum}-${d.isin}-${i}`} className="flex items-center gap-3 px-4 py-3">
                            <PortfolioIsinLogo isin={d.isin} fallbackName={d.name} meta={meta} groesse="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-200">
                                {anzeigeNameFuerIsin(d.isin, d.name, meta)}
                              </p>
                              <p className="text-[11px] text-zinc-500">{formatDatumDe(d.datum)}</p>
                            </div>
                            <div className="text-right">
                              <PaBadge variant="dividend">Dividende</PaBadge>
                              <p className="mt-1 text-sm tabular-nums text-zinc-100">{formatEur(d.betrag)}</p>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </PaCard>
                </div>
              </div>
            )}
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}
