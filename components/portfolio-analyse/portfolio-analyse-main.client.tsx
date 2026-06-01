'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PaGewichtungPanel } from '@/components/portfolio-analyse/pa-gewichtung-panel'
import { PaRenditeHeatmapGrid } from '@/components/portfolio-analyse/pa-heatmap-grid'
import { PaKapitalflussHeatmapGrid } from '@/components/portfolio-analyse/pa-kapitalfluss-grid'
import { PaPerformanceMap } from '@/components/portfolio-analyse/pa-performance-map'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PaIconTabs } from '@/components/portfolio-analyse/pa-ui'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { berechneKapitalflussHeatmap } from '@/lib/portfolio-analyse/kapitalfluss-heatmap'
import { heatmapAusVerlauf } from '@/lib/portfolio-analyse/rendite-heatmap'

type AnalyseTab = 'gewichtung' | 'rendite' | 'kapital' | 'performance' | 'steuern'

const HAUPT_TABS: { id: AnalyseTab; label: string }[] = [
  { id: 'gewichtung', label: 'Gewichtung' },
  { id: 'rendite', label: 'Rendite' },
  { id: 'kapital', label: 'Kapital' },
  { id: 'performance', label: 'Performance Map' },
  { id: 'steuern', label: 'Steuern' },
]

export function PortfolioAnalyseMainClient() {
  const { live, report, meta, hatDaten, laden, buchungen } = usePortfolioAnalyse()
  const [tab, setTab] = useState<AnalyseTab>('gewichtung')
  const [renditeModus, setRenditeModus] = useState<'M' | 'Q'>('M')
  const [kapitalModus, setKapitalModus] = useState<'M' | 'Q'>('M')

  const verlauf = live?.verlauf ?? []
  const heatmap = useMemo(() => heatmapAusVerlauf(verlauf, renditeModus), [verlauf, renditeModus])
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
      description="Gewichtungsanalyse, Rendite-Details und Kapitalfluss — angelehnt an Parqet."
    >
      {!laden && !hatDaten ? null : (
        <PageSection titleId="pa-analyse-heading" title="Auswertung">
          <PageSectionPanel>
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
                    />
                  </div>
                )}

                {tab === 'rendite' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-zinc-100">Rendite Details</h2>
                        <p className="mt-1 text-xs text-zinc-500">
                          Monatliche Rendite aus dem geschätzten Depotverlauf (Kostenbasis + aktueller
                          Marktwert).
                        </p>
                      </div>
                      <PaQmToggle modus={renditeModus} onChange={setRenditeModus} />
                    </div>
                    <PaCard variant="elevated" className="p-4 sm:p-6">
                      <PaRenditeHeatmapGrid heatmap={heatmap} />
                    </PaCard>
                  </div>
                )}

                {tab === 'kapital' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-zinc-100">Kapitalfluss</h2>
                        <p className="mt-1 text-xs text-zinc-500">
                          Monatlicher Kapitalzu- und -abfluss durch Käufe und Verkäufe (Verkauf − Kauf).
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

                {tab === 'steuern' && (
                  <PaCard className="p-6">
                    <h2 className="text-base font-semibold text-zinc-100">Steuern pro Jahr</h2>
                    <p className="mt-1 mb-4 text-[11px] text-zinc-600">
                      Daten nur zur Information — für die Steuererklärung bitte an die Depotbank wenden.
                    </p>
                    <SteuernTabelle buchungen={buchungen} />
                  </PaCard>
                )}
              </div>
            )}
          </PageSectionPanel>
        </PageSection>
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

function SteuernTabelle({ buchungen }: { buchungen: ReturnType<typeof usePortfolioAnalyse>['buchungen'] }) {
  const byYear = useMemo(() => {
    const map = new Map<number, number>()
    for (const b of buchungen) {
      if (b.typ !== 'steuer') continue
      const y = Number(b.datum.slice(0, 4))
      if (!Number.isFinite(y)) continue
      map.set(y, (map.get(y) ?? 0) + b.betragEur)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [buchungen])

  if (byYear.length === 0) {
    return <p className="text-sm text-zinc-500">Keine Steuer-Buchungen erfasst.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
          <th className="py-2 pr-4">Jahr</th>
          <th className="py-2 text-right">Summe</th>
        </tr>
      </thead>
      <tbody>
        {byYear.map(([jahr, summe]) => (
          <tr key={jahr} className="border-b border-zinc-800/40">
            <td className="py-2.5 text-zinc-200">{jahr}</td>
            <td className="py-2.5 text-right tabular-nums text-zinc-100">
              {summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
