'use client'

import { DonutChart } from '@/components/finanzen/donut-chart'
import { GewichtungAssetLogo } from '@/components/portfolio-analyse/isin-logo'
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
import {
  baueXrayRegionAnsicht,
  baueXraySektorAnsicht,
  etfOhneBreakdown,
  gewichtungMitXray,
  type XrayGliederungEintrag,
} from '@/lib/portfolio-analyse/xray-gewichtung'
import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

const DIMENSION_TABS: { id: GewichtungDimension; label: string }[] = [
  { id: 'asset', label: 'Asset' },
  { id: 'assetklasse', label: 'Assetklasse' },
  { id: 'sektor', label: 'Sektor' },
  { id: 'region', label: 'Region' },
  { id: 'typ', label: 'Typ' },
]

function eintraegeOhneXray(
  dimension: GewichtungDimension,
  positionen: LivePosition[],
  report: SinglePortfolioReport | null,
): GewichtungEintrag[] {
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

function wertEurAusEintrag(e: GewichtungEintrag, depotwertEur: number): number {
  if (e.wertEur > 0) return e.wertEur
  return Math.round(((depotwertEur * e.gewichtProzent) / 100) * 100) / 100
}

function assetLogoKontext(
  e: GewichtungEintrag | XrayGliederungEintrag,
  posByIsin: Map<string, LivePosition>,
  symbolZuIsin: Map<string, string>,
  meta: Map<string, IsinMetadata>,
): { isin: string | null; symbol: string | null } {
  const isinKey = 'isin' in e && e.isin ? e.isin.trim().toUpperCase() : null
  if (isinKey && ISIN_RE.test(isinKey)) {
    return { isin: isinKey, symbol: meta.get(isinKey)?.symbolYahoo ?? posByIsin.get(isinKey)?.symbolYahoo ?? null }
  }

  const key = e.key.trim().toUpperCase()
  if (ISIN_RE.test(key)) {
    return { isin: key, symbol: meta.get(key)?.symbolYahoo ?? posByIsin.get(key)?.symbolYahoo ?? null }
  }

  const sym = ('symbol' in e && e.symbol) || key
  const isin = symbolZuIsin.get(sym) ?? symbolZuIsin.get(sym.split('.')[0]!)
  if (isin) {
    return { isin, symbol: meta.get(isin)?.symbolYahoo ?? posByIsin.get(isin)?.symbolYahoo ?? sym }
  }

  return { isin: null, symbol: sym }
}

export function PaGewichtungPanel({
  positionen,
  depotwertEur,
  report,
  meta,
  etfBreakdowns,
  etfBreakdownLaden,
}: {
  positionen: LivePosition[]
  depotwertEur: number
  report: SinglePortfolioReport | null
  meta: Map<string, IsinMetadata>
  etfBreakdowns: Map<string, EtfBreakdown>
  etfBreakdownLaden: boolean
}) {
  const router = useRouter()
  const [dimension, setDimension] = useState<GewichtungDimension>('asset')
  const [xrayAn, setXrayAn] = useState(false)
  const [euroKey, setEuroKey] = useState<string | null>(null)
  const [expandedGruppe, setExpandedGruppe] = useState<string | null>(null)

  useEffect(() => {
    setEuroKey(null)
    setExpandedGruppe(null)
  }, [dimension, xrayAn])

  const posByIsin = useMemo(() => {
    const m = new Map<string, LivePosition>()
    for (const p of positionen) {
      const isin = p.isin?.trim().toUpperCase()
      if (isin) m.set(isin, p)
    }
    return m
  }, [positionen])

  const symbolZuIsin = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of positionen) {
      const isin = p.isin?.trim().toUpperCase()
      if (!isin) continue
      const sym = (p.symbolYahoo ?? meta.get(isin)?.symbolYahoo)?.trim().toUpperCase()
      if (!sym) continue
      m.set(sym, isin)
      m.set(sym.split('.')[0]!, isin)
    }
    return m
  }, [positionen, meta])

  const lookthroughMoeglich = hatXrayLookthrough(report, etfBreakdowns)
  const fehlendeEtf = useMemo(
    () => (xrayAn ? etfOhneBreakdown(positionen, etfBreakdowns) : []),
    [xrayAn, positionen, etfBreakdowns],
  )

  const xraySektor = useMemo(
    () =>
      xrayAn && report
        ? baueXraySektorAnsicht(report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf)
        : null,
    [xrayAn, report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf],
  )

  const xrayRegion = useMemo(
    () =>
      xrayAn && report
        ? baueXrayRegionAnsicht(report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf)
        : null,
    [xrayAn, report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf],
  )

  const eintraege = useMemo((): GewichtungEintrag[] => {
    if (xrayAn && report) {
      if (dimension === 'asset') {
        const { eintraege: xs } = gewichtungMitXray(report, true)
        if (xs.length > 0) return xs
        if (etfBreakdownLaden) return []
      }
      if (dimension === 'sektor') {
        if (xraySektor) return xraySektor.eintraege
        if (etfBreakdownLaden) return []
      }
      if (dimension === 'region') {
        if (xrayRegion) return xrayRegion.eintraege
        if (etfBreakdownLaden) return []
      }
    }
    if (xrayAn && (dimension === 'sektor' || dimension === 'region')) return []
    return eintraegeOhneXray(dimension, positionen, report)
  }, [dimension, positionen, report, xrayAn, etfBreakdownLaden, xraySektor, xrayRegion])

  const gliederung = useMemo((): Map<string, XrayGliederungEintrag[]> | null => {
    if (!xrayAn) return null
    if (dimension === 'sektor') return xraySektor?.gliederung ?? null
    if (dimension === 'region') return xrayRegion?.gliederung ?? null
    return null
  }, [xrayAn, dimension, xraySektor, xrayRegion])

  const summeProzent = useMemo(() => {
    if (dimension === 'sektor') return xraySektor?.summeProzent
    if (dimension === 'region') return xrayRegion?.summeProzent
    return eintraege.reduce((s, e) => s + e.gewichtProzent, 0)
  }, [dimension, xraySektor, xrayRegion, eintraege])

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

  const drilldownAktiv = xrayAn && (dimension === 'sektor' || dimension === 'region') && gliederung != null

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
      {xrayAn && etfBreakdownLaden ? (
        <p className="text-[11px] leading-relaxed text-zinc-500">ETF-Zusammensetzungen werden geladen …</p>
      ) : null}
      {xrayAn && !etfBreakdownLaden && fehlendeEtf.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-amber-200/80">
          {fehlendeEtf.map((p) => p.anzeigeName).join(', ')} ohne Holdings-Daten → erscheint unter „Nicht
          aufgelöst“.
        </p>
      ) : null}
      {xrayAn && !lookthroughMoeglich && !etfBreakdownLaden ? (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          X-Ray benötigt Holdings-Daten der ETFs. Für Index-ETFs werden alle Konstituenten geladen; sonst Amundi/Yahoo.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PaCard variant="elevated" className="flex flex-col items-center justify-center p-6">
          <p className="mb-4 self-start text-sm font-medium text-zinc-300">{titel}</p>
          <DonutChart
            segmente={donut}
            groesse={220}
            dicke={28}
            mitte={{ wert: formatEur(depotwertEur) }}
          />
          <p className="mt-3 text-center text-lg font-semibold tabular-nums text-white">
            {formatEur(depotwertEur)}
          </p>
          <p className="text-[11px] text-zinc-500">Gesamt</p>
          {summeProzent != null ? (
            <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
              Summe sichtbar: {summeProzent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %
            </p>
          ) : null}
        </PaCard>

        <PaCard variant="elevated" className="max-h-[28rem] overflow-y-auto p-4">
          <p className="mb-3 text-[11px] text-zinc-600">
            {drilldownAktiv
              ? 'Sektor/Region antippen → enthaltene Firmen anzeigen · erneut antippen für Euro'
              : 'Antippen für Depotwert in Euro'}
          </p>
          <ul className="space-y-4">
            {eintraege.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-500">
                {xrayAn && etfBreakdownLaden ? 'X-Ray wird vorbereitet …' : 'Keine Positionen.'}
              </li>
            ) : (
              eintraege.map((e) => {
                const wertEur = wertEurAusEintrag(e, depotwertEur)
                const zeigeEuro = euroKey === e.key
                const expanded = expandedGruppe === e.key
                const firmen = gliederung?.get(e.key) ?? []

                const onRowClick = () => {
                  if (drilldownAktiv && firmen.length > 0) {
                    setExpandedGruppe((k) => (k === e.key ? null : e.key))
                    setEuroKey(null)
                    return
                  }
                  setEuroKey((k) => (k === e.key ? null : e.key))
                }

                return (
                  <li key={e.key}>
                    <div
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-1 -mx-1 hover:bg-white/[0.03] ${expanded ? 'bg-white/[0.02]' : ''}`}
                      onClick={onRowClick}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          onRowClick()
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={expanded}
                    >
                      {dimension === 'asset' ? (
                        (() => {
                          const logoCtx = assetLogoKontext(e, posByIsin, symbolZuIsin, meta)
                          const pos = logoCtx.isin ? posByIsin.get(logoCtx.isin) : undefined
                          const fundamentalHref =
                            pos?.assetKlasse === 'aktie' && pos.isin
                              ? fundamentaldatenHref({ isin: pos.isin })
                              : null
                          return (
                            <button
                              type="button"
                              className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/60"
                              title={fundamentalHref ? 'Fundamentaldaten öffnen' : e.label}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                if (fundamentalHref) router.push(fundamentalHref)
                                else setEuroKey((k) => (k === e.key ? null : e.key))
                              }}
                            >
                              <GewichtungAssetLogo
                                isin={logoCtx.isin}
                                symbol={logoCtx.symbol}
                                label={e.label}
                                meta={meta}
                                groesse="sm"
                              />
                            </button>
                          )
                        })()
                      ) : (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: e.farbe }}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                        {e.label}
                        <span className="text-zinc-500"> ({e.anzahl})</span>
                        {drilldownAktiv && firmen.length > 0 ? (
                          <span className="ml-1 text-[10px] text-zinc-600">
                            {expanded ? '▾' : '▸'}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`shrink-0 text-sm tabular-nums ${zeigeEuro ? 'font-semibold text-teal-300' : 'text-zinc-100'}`}
                      >
                        {zeigeEuro
                          ? formatEur(wertEur)
                          : `${e.gewichtProzent.toLocaleString('de-DE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} %`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${Math.min(100, e.gewichtProzent)}%` }}
                      />
                    </div>

                    {expanded && firmen.length > 0 ? (
                      <ul className="mt-2 space-y-2 border-l border-zinc-800 pl-3 ml-1">
                        {firmen.slice(0, 25).map((f) => {
                          const logoCtx = assetLogoKontext(f, posByIsin, symbolZuIsin, meta)
                          const pos = logoCtx.isin ? posByIsin.get(logoCtx.isin) : undefined
                          const fEuro = euroKey === f.key
                          return (
                            <li key={f.key} className="flex items-center gap-2">
                              <GewichtungAssetLogo
                                isin={logoCtx.isin}
                                symbol={logoCtx.symbol ?? f.symbol}
                                label={f.label}
                                meta={meta}
                                groesse="sm"
                              />
                              <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{f.label}</span>
                              <button
                                type="button"
                                className="shrink-0 text-xs tabular-nums text-zinc-300 hover:text-teal-300"
                                onClick={() => setEuroKey((k) => (k === f.key ? null : f.key))}
                              >
                                {fEuro
                                  ? formatEur(f.wertEur)
                                  : `${f.gewichtProzent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`}
                              </button>
                            </li>
                          )
                        })}
                        {firmen.length > 25 ? (
                          <li className="text-[11px] text-zinc-600">
                            + {firmen.length - 25} weitere Positionen
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>
        </PaCard>
      </div>
    </div>
  )
}
