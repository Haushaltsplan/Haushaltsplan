'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PaGewichtungPanel } from '@/components/portfolio-analyse/pa-gewichtung-panel'
import { PaKapitalflussHeatmapGrid } from '@/components/portfolio-analyse/pa-kapitalfluss-grid'
import { PaSteuernPanel } from '@/components/portfolio-analyse/pa-steuern-panel'
import { PaPerformanceMap } from '@/components/portfolio-analyse/pa-performance-map'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaIconTabs } from '@/components/portfolio-analyse/pa-ui'
import { berechneKapitalflussHeatmap } from '@/lib/portfolio-analyse/kapitalfluss-heatmap'

type AnalyseTab = 'gewichtung' | 'kapital' | 'performance' | 'steuern'

const HAUPT_TABS: { id: AnalyseTab; label: string; shortLabel: string }[] = [
  { id: 'gewichtung', label: 'Gewichtung', shortLabel: 'Gewicht.' },
  { id: 'kapital', label: 'Kapital', shortLabel: 'Kapital' },
  { id: 'performance', label: 'Performance Map', shortLabel: 'Perf.' },
  { id: 'steuern', label: 'Steuern', shortLabel: 'Steuern' },
]

export function PortfolioAnalyseMainClient() {
  const { live, report, meta, hatDaten, laden, buchungen, etfBreakdowns, etfBreakdownLaden } =
    usePortfolioAnalyse()
  const [tab, setTab] = useState<AnalyseTab>('gewichtung')
  const [kapitalModus, setKapitalModus] = useState<'M' | 'Q'>('M')

  const kapitalHeatmap = useMemo(
    () => berechneKapitalflussHeatmap(buchungen, kapitalModus),
    [buchungen, kapitalModus],
  )

  const assetKlassen = live?.positionen
    ? new Set(live.positionen.map((p) => p.assetKlasse)).size
    : 0
  const positionenCount = live?.positionen.length ?? 0

  return (
    <PortfolioAnalyseShell
      title="Portfolioanalyse"
      description="Gewichtungsanalyse, Kapitalfluss und Performance — angelehnt an Parqet."
    >
      {!laden && !hatDaten ? null : (
        <PaCard variant="elevated" className="min-w-0 overflow-hidden p-4 sm:p-6">
            {!hatDaten ? (
              <p className="text-sm text-zinc-500">
                <Link href="/portfolioanalyse/import" className="text-teal-400 hover:underline">
                  Daten importieren
                </Link>{' '}
                für die Analyse.
              </p>
            ) : liveLadenOhneDaten(live, laden) ? (
              <p className="py-12 text-center text-sm text-zinc-500">Portfolio wird geladen …</p>
            ) : (
              <div className="space-y-6">
                <PaIconTabs tabs={HAUPT_TABS} active={tab} onChange={setTab} />

                {tab === 'gewichtung' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">Gewichtungsanalyse</h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        {assetKlassen} Assetklassen · {positionenCount} Assets
                        {report?.allocation.bySector.length
                          ? ` · ${report.allocation.bySector.length} Sektoren`
                          : ''}
                        {report?.allocation.byCountry.length
                          ? ` · ${report.allocation.byCountry.length} Regionen`
                          : ''}
                      </p>
                    </div>
                    <PaGewichtungPanel
                      positionen={live!.positionen}
                      depotwertEur={live!.kennzahlen.depotwertEur}
                      report={report}
                      meta={meta}
                      etfBreakdowns={etfBreakdowns}
                      etfBreakdownLaden={etfBreakdownLaden}
                    />
                  </div>
                )}

                {tab === 'kapital' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-zinc-100">Kapitalfluss</h2>
                        <p className="mt-1 text-xs text-zinc-500">
                          Monatlicher Kapitalzu- und -abfluss durch Käufe und Verkäufe (Kauf − Verkauf).
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Link
                          href="/portfolioanalyse/aktivitaeten"
                          className="text-xs text-teal-400 hover:underline"
                        >
                          Zu den einzelnen Aktivitäten →
                        </Link>
                        <PaQmToggle modus={kapitalModus} onChange={setKapitalModus} />
                      </div>
                    </div>
                    <PaCard variant="elevated" className="p-4 sm:p-6">
                      <PaKapitalflussHeatmapGrid heatmap={kapitalHeatmap} />
                    </PaCard>
                  </div>
                )}

                {tab === 'performance' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">Performance Map</h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        Kacheln nach Sektor — Größe = Gewicht, Farbe = Tages- bzw. Gesamtperformance.
                      </p>
                    </div>
                    <PaPerformanceMap positionen={live!.positionen} />
                  </div>
                )}

                {tab === 'steuern' && <PaSteuernPanel buchungen={buchungen} />}
              </div>
            )}
        </PaCard>
      )}
    </PortfolioAnalyseShell>
  )
}

function PaQmToggle({
  modus,
  onChange,
}: {
  modus: 'M' | 'Q'
  onChange: (m: 'M' | 'Q') => void
}) {
  return (
    <div className="flex rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5 text-xs">
      {(['Q', 'M'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1.5 font-medium transition ${
            modus === m ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

function liveLadenOhneDaten(
  live: ReturnType<typeof usePortfolioAnalyse>['live'],
  laden: boolean,
): boolean {
  return laden && !live
}
