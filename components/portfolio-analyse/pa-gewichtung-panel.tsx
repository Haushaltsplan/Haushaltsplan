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
  baueRegionAnsicht,
  baueSektorAnsicht,
  etfOhneBreakdown,
  gewichtungMitXray,
  type XrayGliederungEintrag,
} from '@/lib/portfolio-analyse/xray-gewichtung'
import {
  LEERER_SEKTOR_LOOKUP,
  ladeFundamentalSektoren,
  sammleSektorAnfragen,
  type FundamentalSektorLookup,
} from '@/lib/portfolio-analyse/sektor-fundamental-client'
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
  const [fundamentalSektoren, setFundamentalSektoren] = useState<FundamentalSektorLookup>(
    LEERER_SEKTOR_LOOKUP,
  )
  const [sektorNachladen, setSektorNachladen] = useState(false)

  const sektorAnfragen = useMemo(
    () => sammleSektorAnfragen(positionen, meta, report, xrayAn),
    [positionen, meta, report, xrayAn],
  )
  const sektorAnfragenKey = sektorAnfragen
    .map((a) => `${a.isin ?? ''}|${a.symbolYahoo ?? ''}`)
    .join(';')

  useEffect(() => {
    if (sektorAnfragen.length === 0) {
      setFundamentalSektoren(LEERER_SEKTOR_LOOKUP)
      return
    }

    let cancelled = false
    setSektorNachladen(true)
    void ladeFundamentalSektoren(sektorAnfragen)
      .then((lookup) => {
        if (!cancelled) setFundamentalSektoren(lookup)
      })
      .finally(() => {
        if (!cancelled) setSektorNachladen(false)
      })

    return () => {
      cancelled = true
    }
  }, [sektorAnfragenKey, sektorAnfragen.length])

  useEffect(() => {
    setEuroKey(null)
    setExpandedGruppe(null)
  }, [dimension, xrayAn])

  const fehlendeEtf = useMemo(
    () => (xrayAn ? etfOhneBreakdown(positionen, etfBreakdowns) : []),
    [xrayAn, positionen, etfBreakdowns],
  )

  const sektorAnsicht = useMemo(
    () =>
      baueSektorAnsicht(
        report,
        positionen,
        meta,
        etfBreakdowns,
        depotwertEur,
        fehlendeEtf,
        xrayAn,
        fundamentalSektoren,
      ),
    [report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf, xrayAn, fundamentalSektoren],
  )

  const regionAnsicht = useMemo(
    () =>
      baueRegionAnsicht(report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf, xrayAn),
    [report, positionen, meta, etfBreakdowns, depotwertEur, fehlendeEtf, xrayAn],
  )

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

  const eintraege = useMemo((): GewichtungEintrag[] => {
    if (dimension === 'sektor') {
      if (xrayAn && etfBreakdownLaden && !sektorAnsicht) return []
      return sektorAnsicht?.eintraege ?? []
    }
    if (dimension === 'region') {
      if (xrayAn && etfBreakdownLaden && !regionAnsicht) return []
      return regionAnsicht?.eintraege ?? []
    }
    if (xrayAn && report && dimension === 'asset') {
      const { eintraege: xs } = gewichtungMitXray(report, true)
      if (xs.length > 0) return xs
      if (etfBreakdownLaden) return []
    }
    return eintraegeOhneXray(dimension, positionen, report)
  }, [dimension, positionen, report, xrayAn, etfBreakdownLaden, sektorAnsicht, regionAnsicht])

  const gliederung = useMemo((): Map<string, XrayGliederungEintrag[]> | null => {
    if (dimension === 'sektor') return sektorAnsicht?.gliederung ?? null
    if (dimension === 'region') return regionAnsicht?.gliederung ?? null
    return null
  }, [dimension, sektorAnsicht, regionAnsicht])

  const summeProzent = useMemo(() => {
    if (dimension === 'sektor') return sektorAnsicht?.summeProzent
    if (dimension === 'region') return regionAnsicht?.summeProzent
    return eintraege.reduce((s, e) => s + e.gewichtProzent, 0)
  }, [dimension, sektorAnsicht, regionAnsicht, eintraege])

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

  const drilldownAktiv =
    (dimension === 'sektor' || dimension === 'region') && gliederung != null && eintraege.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PaIconTabs tabs={DIMENSION_TABS} active={dimension} onChange={setDimension} className="flex-1" />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
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

      <p className="text-xs text-[var(--app-text-muted)]">{stats}</p>
      {xrayAn && etfBreakdownLaden ? (
        <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">ETF-Zusammensetzungen werden geladen …</p>
      ) : null}
      {xrayAn && !etfBreakdownLaden && fehlendeEtf.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-amber-200/80">
          {fehlendeEtf.map((p) => p.anzeigeName).join(', ')} ohne Holdings-Daten → erscheint unter „Nicht
          aufgelöst“.
        </p>
      ) : null}
      {xrayAn && !lookthroughMoeglich && !etfBreakdownLaden ? (
        <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
          X-Ray benötigt Holdings-Daten der ETFs. Für Index-ETFs werden alle Konstituenten geladen; sonst Amundi/Yahoo.
        </p>
      ) : null}
      {sektorNachladen ? (
        <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
          Sektoren aus Fundamentaldaten werden geladen …
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PaCard variant="elevated" className="flex flex-col items-center justify-center p-6">
          <p className="mb-4 self-start text-sm font-medium text-[var(--app-text)]">{titel}</p>
          <DonutChart
            segmente={donut}
            groesse={220}
            dicke={28}
            mitte={{ wert: formatEur(depotwertEur) }}
          />
          <p className="mt-3 text-center text-lg font-semibold tabular-nums text-white">
            {formatEur(depotwertEur)}
          </p>
          <p className="text-[11px] text-[var(--app-text-muted)]">Gesamt</p>
          {summeProzent != null ? (
            <p className="mt-1 text-[11px] tabular-nums text-[var(--app-text-muted)]">
              Summe sichtbar: {summeProzent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %
            </p>
          ) : null}
        </PaCard>

        <PaCard variant="elevated" className="max-h-[28rem] overflow-y-auto p-4">
          <p className="mb-3 text-[11px] text-[var(--app-text-muted)]">
            {drilldownAktiv
              ? 'Sektor antippen → Firmen darunter · Firmenzeile antippen für Euro'
              : 'Antippen für Depotwert in Euro'}
          </p>
          <ul className="space-y-4">
            {eintraege.length === 0 ? (
              <li className="py-8 text-center text-sm text-[var(--app-text-muted)]">
                {xrayAn && etfBreakdownLaden ? 'X-Ray wird vorbereitet …' : 'Keine Positionen.'}
              </li>
            ) : (
              eintraege.map((e) => {
                const wertEur = wertEurAusEintrag(e, depotwertEur)
                const zeigeEuro = euroKey === e.key
                const expanded = expandedGruppe === e.key
                const firmen = gliederung?.get(e.key) ?? gliederung?.get(e.label) ?? []

                const onRowClick = () => {
                  if (drilldownAktiv) {
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
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--app-text)]">
                        {e.label}
                        <span className="text-[var(--app-text-muted)]"> ({e.anzahl})</span>
                        {drilldownAktiv ? (
                          <span className="ml-1 text-[10px] text-[var(--app-text-muted)]">
                            {expanded ? '▾' : '▸'}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`shrink-0 text-sm tabular-nums ${zeigeEuro ? 'font-semibold text-teal-300' : 'text-[var(--app-text)]'}`}
                      >
                        {zeigeEuro
                          ? formatEur(wertEur)
                          : `${e.gewichtProzent.toLocaleString('de-DE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} %`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${Math.min(100, e.gewichtProzent)}%` }}
                      />
                    </div>

                    {expanded ? (
                      firmen.length > 0 ? (
                      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto border-l border-[var(--app-border)] pl-3 ml-1">
                        {firmen.map((f) => {
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
                              <span className="min-w-0 flex-1 truncate text-xs text-[var(--app-text-muted)]">{f.label}</span>
                              <button
                                type="button"
                                className="shrink-0 text-xs tabular-nums text-[var(--app-text)] hover:text-teal-300"
                                onClick={() => setEuroKey((k) => (k === f.key ? null : f.key))}
                              >
                                {fEuro
                                  ? formatEur(f.wertEur)
                                  : `${f.gewichtProzent.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      ) : (
                        <p className="mt-2 pl-3 text-[11px] text-[var(--app-text-muted)]">Keine Detailpositionen in dieser Gruppe.</p>
                      )
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
