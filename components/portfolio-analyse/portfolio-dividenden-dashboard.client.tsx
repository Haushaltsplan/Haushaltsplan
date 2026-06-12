'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PaAnkuendigteDividenden } from '@/components/portfolio-analyse/pa-ankuendigte-dividenden'
import { PaGestapelteDividendenChart } from '@/components/portfolio-analyse/pa-dividenden-chart'
import { PaDividendenHeatmapGrid } from '@/components/portfolio-analyse/pa-dividenden-heatmap'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaBadge, PaCard, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import { dividendenKalender } from '@/lib/portfolio-analyse/auswertungen'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import {
  berechneDividendenHeatmap,
  berechneDividendenKpis,
  dividendenGestapeltProMonat,
  dividendenProJahrMitVergleich,
} from '@/lib/portfolio-analyse/dividenden-auswertung'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  ladeAnkuendigteDividendenDepot,
  ladeAnkuendigteDividendenDepotAusLocalCache,
} from '@/lib/portfolio-analyse/ankuendigte-dividenden-client'
import type { AnkuendigteDividendenErgebnis } from '@/lib/portfolio-analyse/ankuendigte-dividenden'

export function PortfolioDividendenDashboardClient() {
  const router = useRouter()
  const { buchungen, live, report, meta, hatDaten, laden } = usePortfolioAnalyse()
  const [ankuendig, setAnkuendig] = useState<AnkuendigteDividendenErgebnis | null>(null)
  const [ankuendigLaden, setAnkuendigLaden] = useState(false)
  const [ankuendigFehler, setAnkuendigFehler] = useState<string | null>(null)

  const k = live?.kennzahlen
  const positionen = live?.positionen ?? []

  const depotKey = useMemo(
    () =>
      positionen
        .filter((p) => p.stueck > 0)
        .map((p) => `${p.isin ?? ''}:${p.symbolYahoo ?? ''}:${p.stueck}`)
        .join('|'),
    [positionen],
  )

  const metaKey = useMemo(() => [...meta.keys()].sort().join('|'), [meta])

  useEffect(() => {
    const pos = live?.positionen ?? []
    if (!hatDaten || pos.length === 0) {
      setAnkuendig(null)
      setAnkuendigFehler(null)
      return
    }
    const cached = ladeAnkuendigteDividendenDepotAusLocalCache(pos, meta)
    if (cached) setAnkuendig(cached)

    let cancelled = false
    async function run() {
      setAnkuendigLaden(!cached)
      setAnkuendigFehler(null)
      try {
        const res = await ladeAnkuendigteDividendenDepot(pos, meta)
        if (!cancelled) setAnkuendig(res)
      } catch (e) {
        if (!cancelled) {
          setAnkuendig(null)
          setAnkuendigFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
        }
      } finally {
        if (!cancelled) setAnkuendigLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [depotKey, metaKey, hatDaten, live, meta])
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

  const divSerie = useMemo(() => dividendenGestapeltProMonat(buchungen, meta), [buchungen, meta])
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

                <PaCard variant="elevated" className="overflow-visible">
                  <div className="border-b border-zinc-800/60 px-4 py-3 sm:px-6">
                    <h2 className="text-sm font-semibold text-zinc-100">Monatlich</h2>
                  </div>
                  <div className="overflow-visible p-4 sm:p-6">
                    <PaGestapelteDividendenChart
                      daten={divSerie.monate}
                      durchschnittIntervallEur={divSerie.durchschnittIntervallEur}
                      hoehe={280}
                    />
                  </div>
                  <div className="border-t border-zinc-800/60 px-4 py-3 sm:px-6">
                    <h2 className="text-sm font-semibold text-zinc-100">Heatmap</h2>
                    <p className="mt-0.5 text-[11px] text-zinc-500">Dividenden pro Jahr und Monat (EUR)</p>
                  </div>
                  <div className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <PaDividendenHeatmapGrid heatmap={heatmap} />
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

                  <PaCard variant="elevated" className="flex flex-col p-5">
                    <h2 className="text-sm font-semibold text-zinc-100">Angekündigte Dividenden</h2>
                    <div className="mt-3 min-h-0 flex-1">
                      <PaAnkuendigteDividenden
                        daten={ankuendig}
                        meta={meta}
                        laden={ankuendigLaden}
                        fehler={ankuendigFehler}
                      />
                    </div>
                  </PaCard>

                  <PaCard className="flex flex-col">
                    <div className="border-b border-zinc-800/60 px-5 py-3">
                      <h2 className="text-sm font-semibold text-zinc-100">Letzte Auszahlungen</h2>
                    </div>
                    <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
                      {letzteDivs.length === 0 ? (
                        <li className="px-5 py-8 text-center text-sm text-zinc-500">Keine Dividenden.</li>
                      ) : (
                        letzteDivs.map((d, i) => {
                          const href = d.isin ? fundamentaldatenHref({ isin: d.isin }) : null
                          return (
                          <li
                            key={`${d.datum}-${d.isin}-${i}`}
                            className={`flex items-center gap-3 px-4 py-3 ${href ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
                            onClick={href ? () => router.push(href) : undefined}
                          >
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
                        )})
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
