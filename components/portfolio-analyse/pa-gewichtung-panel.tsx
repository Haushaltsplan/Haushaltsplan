'use client'

import { DonutChart } from '@/components/finanzen/donut-chart'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaCard, PaIconTabs } from '@/components/portfolio-analyse/pa-ui'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import {
  eintraegeZuDonut,
  gewichtungAusSlices,
  gewichtungNachAsset,
  gewichtungNachAssetklasse,
  gewichtungStatistik,
  type GewichtungDimension,
  type GewichtungEintrag,
} from '@/lib/portfolio-analyse/gewichtung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { hatXrayLookthrough } from '@/lib/portfolio-analyse/performance-map'
import type { SinglePortfolioReport } from '@/lib/portfolio-analyse/parqet-core/types'
import { gewichtungMitXray, xrayLaender, xraySektoren } from '@/lib/portfolio-analyse/xray-gewichtung'
import { useMemo, useState } from 'react'

const DIMENSION_TABS: { id: GewichtungDimension; label: string }[] = [
  { id: 'asset', label: 'Asset' },
  { id: 'assetklasse', label: 'Assetklasse' },
  { id: 'sektor', label: 'Sektor' },
  { id: 'region', label: 'Region' },
  { id: 'typ', label: 'Typ' },
]

function eintraegeFuerDimension(
  dimension: GewichtungDimension,
  positionen: LivePosition[],
  report: SinglePortfolioReport | null,
  xrayAn: boolean,
): GewichtungEintrag[] {
  if (xrayAn && report) {
    if (dimension === 'asset') {
      const { eintraege } = gewichtungMitXray(report, true)
      if (eintraege.length > 0) return eintraege
    }
    if (dimension === 'sektor') {
      const s = xraySektoren(report, true)
      if (s.length > 0) return s
    }
    if (dimension === 'region') {
      const c = xrayLaender(report, true)
      if (c.length > 0) return c
    }
  }

  switch (dimension) {
    case 'asset':
      return gewichtungNachAsset(positionen)
    case 'assetklasse':
    case 'typ':
      return gewichtungNachAssetklasse(positionen)
    case 'sektor': {
      const sectors = (report?.allocation.bySector ?? []).filter(
        (s) => s.valueEUR > 0 && s.label !== 'Unbekannt',
      )
      return sectors.length > 0 ? gewichtungAusSlices(sectors) : gewichtungNachAssetklasse(positionen)
    }
    case 'region': {
      const countries = (report?.allocation.byCountry ?? []).filter(
        (s) => s.valueEUR > 0 && s.label !== 'Unbekannt',
      )
      return countries.length > 0 ? gewichtungAusSlices(countries) : gewichtungNachAssetklasse(positionen)
    }
    default:
      return gewichtungNachAsset(positionen)
  }
}

export function PaGewichtungPanel({
  positionen,
  depotwertEur,
  report,
  meta,
}: {
  positionen: LivePosition[]
  depotwertEur: number
  report: SinglePortfolioReport | null
  meta: Map<string, IsinMetadata>
}) {
  const [dimension, setDimension] = useState<GewichtungDimension>('asset')
  const [xrayAn, setXrayAn] = useState(false)

  const lookthroughMoeglich = hatXrayLookthrough(report)

  const eintraege = useMemo(
    () => eintraegeFuerDimension(dimension, positionen, report, xrayAn),
    [dimension, positionen, report, xrayAn],
  )

  const donut = useMemo(() => eintraegeZuDonut(eintraege), [eintraege])
  const stats = gewichtungStatistik(eintraege, dimension)
  const titel =
    dimension === 'asset'
      ? 'Nach Asset'
      : dimension === 'sektor'
        ? 'Nach Sektor'
        : dimension === 'region'
          ? 'Nach Region'
          : dimension === 'typ'
            ? 'Nach Typ'
            : 'Nach Assetklasse'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PaIconTabs tabs={DIMENSION_TABS} active={dimension} onChange={setDimension} className="flex-1" />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={xrayAn}
            onChange={(e) => setXrayAn(e.target.checked)}
            className="accent-teal-500"
          />
          X-Ray
          {lookthroughMoeglich ? (
            <span className="rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] text-teal-400">ETF</span>
          ) : null}
        </label>
      </div>

      <p className="text-xs text-zinc-500">{stats}</p>
      {xrayAn && !lookthroughMoeglich ? (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          X-Ray nutzt verfügbare Engine-Daten. ETF-Look-through (Unterpositionen) erscheint, sobald{' '}
          <code className="text-teal-500/90">etfBreakdown</code> in den Holdings hinterlegt ist — bis dahin
          Einzelpositionen und manuelle Sektoren.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PaCard className="flex flex-col items-center justify-center p-6">
          <p className="mb-4 self-start text-sm font-medium text-zinc-300">{titel}</p>
          <DonutChart segmente={donut} groesse={220} dicke={28} />
          <p className="mt-3 text-center text-lg font-semibold tabular-nums text-white">
            {formatEur(depotwertEur)}
          </p>
          <p className="text-[11px] text-zinc-500">Gesamt</p>
        </PaCard>

        <PaCard className="max-h-[28rem] overflow-y-auto p-4">
          <ul className="space-y-4">
            {eintraege.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-500">Keine Positionen.</li>
            ) : (
              eintraege.map((e) => (
                <li key={e.key}>
                  <div className="flex items-center gap-2">
                    {dimension === 'asset' && !xrayAn ? (
                      <PortfolioIsinLogo
                        isin={e.key.length >= 12 ? e.key : null}
                        fallbackName={e.label}
                        meta={meta}
                        groesse="sm"
                      />
                    ) : (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: e.farbe }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                      {e.label}
                      {e.anzahl > 1 || dimension !== 'asset' ? (
                        <span className="text-zinc-500"> ({e.anzahl})</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-zinc-100">
                      {e.gewichtProzent.toLocaleString('de-DE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      %
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${Math.min(100, e.gewichtProzent)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </PaCard>
      </div>
    </div>
  )
}
