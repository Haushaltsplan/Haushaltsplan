'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaFundamentalKeyMetrics } from '@/components/portfolio-analyse/pa-fundamental-key-metrics'
import { PaFundamentalUnternehmenHeader } from '@/components/portfolio-analyse/pa-fundamental-unternehmen-header'
import { PaFundamentalKursChart } from '@/components/portfolio-analyse/pa-fundamental-kurs-chart'
import { PaFundamentalMetrikChart } from '@/components/portfolio-analyse/pa-fundamental-metrik-chart'
import { PaFundamentalMetrikTabelle } from '@/components/portfolio-analyse/pa-fundamental-metrik-tabelle'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  ladeFundamentaldatenAusLocalCache,
  ladeFundamentaldatenClient,
} from '@/lib/portfolio-analyse/fundamentaldaten-client'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

type DepotPosition = {
  isin: string | null
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  stueck: number
}

const UNTER_TABS = [
  { id: 'uebersicht' as const, label: 'Übersicht' },
  { id: 'finanzdaten' as const, label: 'Finanzdaten' },
  { id: 'schaetzungen' as const, label: 'Schätzungen' },
  { id: 'bewertung' as const, label: 'Bewertung' },
  { id: 'news' as const, label: 'News' },
]

export function PortfolioFundamentaldatenClient() {
  const { live, meta, hatDaten, laden: paLaden } = usePortfolioAnalyse()
  const [unterTab, setUnterTab] = useState<(typeof UNTER_TABS)[number]['id']>('uebersicht')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [daten, setDaten] = useState<FundamentaldatenPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [tickerOverride, setTickerOverride] = useState('')
  const [chartAktiv, setChartAktiv] = useState<Set<string>>(new Set())
  const [labelsAnzeigen, setLabelsAnzeigen] = useState(true)

  const positionen = useMemo<DepotPosition[]>(() => {
    return (live?.positionen ?? [])
      .filter((p) => p.stueck > 0 && p.assetKlasse === 'aktie')
      .map((p) => {
        const isin = p.isin?.trim().toUpperCase() ?? ''
        const k = isin ? isinKenntnis(isin) : undefined
        const m = isin ? meta.get(isin) : undefined
        return {
          isin: isin || null,
          name: p.name ?? k?.name ?? m?.name ?? 'Unbekannt',
          symbolYahoo: p.symbolYahoo ?? k?.symbolYahoo ?? m?.symbolYahoo ?? null,
          symbolCandidates: [...(k?.symbolCandidates ?? []), ...(m?.symbolYahoo ? [m.symbolYahoo] : [])],
          stueck: p.stueck,
        }
      })
  }, [live?.positionen, meta])

  const selected = positionen[selectedIdx] ?? null

  const anfrage = useMemo(
    () =>
      selected
        ? {
            isin: selected.isin,
            name: selected.name,
            symbolYahoo: selected.symbolYahoo,
            symbolCandidates: selected.symbolCandidates,
            tickerOverride: tickerOverride.trim() || null,
          }
        : null,
    [selected, tickerOverride],
  )

  useEffect(() => {
    setChartAktiv(new Set())
  }, [selected?.isin, selected?.symbolYahoo, tickerOverride])

  useEffect(() => {
    if (!anfrage) {
      setDaten(null)
      return
    }
    const cached = ladeFundamentaldatenAusLocalCache(anfrage)
    if (cached?.ok) setDaten(cached)

    let cancelled = false
    async function run() {
      setLaden(!cached?.ok)
      setFehler(null)
      try {
        const res = await ladeFundamentaldatenClient(anfrage!)
        if (!cancelled) setDaten(res)
      } catch (e) {
        if (!cancelled) {
          setDaten(cached ?? null)
          setFehler(e instanceof Error ? e.message : 'Abruf fehlgeschlagen')
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [anfrage])

  const toggleChartZeile = useCallback((id: string) => {
    setChartAktiv((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const rentabilitaet = daten?.zeilen.filter((z) => z.gruppe === 'rentabilitaet') ?? []
  const margen = daten?.zeilen.filter((z) => z.gruppe === 'margen') ?? []
  const umschlag = daten?.zeilen.filter((z) => z.gruppe === 'umschlag') ?? []
  const finanzdaten = daten?.zeilen.filter((z) => z.gruppe === 'finanzdaten') ?? []
  const cashflow = daten?.zeilen.filter((z) => z.gruppe === 'cashflow') ?? []
  const bewertung = daten?.zeilen.filter((z) => z.gruppe.startsWith('bewertung')) ?? []
  const schaetzungen = daten?.zeilen.filter((z) => z.gruppe === 'schaetzungen') ?? []

  return (
    <PortfolioAnalyseShell
      title="Fundamentaldaten"
      description="Historische Kennzahlen und Bewertungsmultiples im TIKR-Stil — Daten von Macrotrends.net."
    >
      {!hatDaten && !paLaden ? (
        <PaCard className="p-6 text-sm text-zinc-400">Importiere zuerst Portfolio-Daten.</PaCard>
      ) : positionen.length === 0 ? (
        <PaCard className="p-6 text-sm text-zinc-400">Keine Aktienpositionen im Depot.</PaCard>
      ) : (
        <div className="space-y-4">
          <PaCard className="p-3 sm:p-4">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Unternehmen
            </label>
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {positionen.map((p, i) => (
                <option key={`${p.isin ?? p.name}-${i}`} value={i}>
                  {p.name}
                  {p.symbolYahoo ? ` (${p.symbolYahoo})` : ''}
                </option>
              ))}
            </select>
          </PaCard>

          {laden && !daten?.ok ? (
            <PaCard className="p-8 text-center text-sm text-zinc-500">
              Fundamentaldaten werden von Macrotrends geladen …
            </PaCard>
          ) : null}

          {fehler && !daten?.ok ? (
            <PaCard className="space-y-4 p-6">
              <p className="text-sm text-amber-200/90">{fehler}</p>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Macrotrends-Ticker manuell (z. B. AAPL, ASML)</label>
                <div className="flex gap-2">
                  <input
                    value={tickerOverride}
                    onChange={(e) => setTickerOverride(e.target.value.toUpperCase())}
                    placeholder="Ticker"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => setTickerOverride((t) => t.trim())}
                    className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
                  >
                    Laden
                  </button>
                </div>
              </div>
            </PaCard>
          ) : null}

          {daten?.ok ? (
            <>
              <PaFundamentalUnternehmenHeader
                firmenname={daten.firmenname}
                ticker={daten.ticker}
                branche={daten.branche}
                sektor={daten.sektor}
                website={daten.website}
                beschreibung={daten.beschreibung}
                tabs={UNTER_TABS}
                activeTab={unterTab}
                onTabChange={setUnterTab}
              />

              {unterTab === 'uebersicht' ? (
                <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                  <PaFundamentalKursChart
                    symbolYahoo={daten.symbolYahoo}
                    ticker={daten.ticker}
                    firmenname={daten.firmenname}
                  />
                  <PaFundamentalKeyMetrics metriken={daten.keyMetrics} />
                </div>
              ) : null}

              {unterTab !== 'uebersicht' && unterTab !== 'news' ? (
                <div className="space-y-4">
                  <PaFundamentalMetrikChart
                    perioden={daten.perioden}
                    zeilen={daten.zeilen}
                    aktivIds={chartAktiv}
                    labelsAnzeigen={labelsAnzeigen}
                    onClear={() => setChartAktiv(new Set())}
                    onToggleLabels={() => setLabelsAnzeigen((v) => !v)}
                  />

                  {(unterTab === 'finanzdaten') && finanzdaten.length > 0 ? (
                    <PaFundamentalMetrikTabelle
                      titel="GuV / Finanzdaten (Mio. USD)"
                      perioden={daten.perioden}
                      zeilen={finanzdaten}
                      aktivIds={chartAktiv}
                      onToggleZeile={toggleChartZeile}
                    />
                  ) : null}

                  {(unterTab === 'finanzdaten') && cashflow.length > 0 ? (
                    <PaFundamentalMetrikTabelle
                      titel="Cashflow (Mio. USD)"
                      perioden={daten.perioden}
                      zeilen={cashflow}
                      aktivIds={chartAktiv}
                      onToggleZeile={toggleChartZeile}
                    />
                  ) : null}

                  {(unterTab === 'finanzdaten') && rentabilitaet.length + margen.length + umschlag.length > 0 ? (
                    <PaFundamentalMetrikTabelle
                      titel="Rentabilitätskennzahlen & Margenanalyse"
                      perioden={daten.perioden}
                      zeilen={[...rentabilitaet, ...margen, ...umschlag]}
                      aktivIds={chartAktiv}
                      onToggleZeile={toggleChartZeile}
                    />
                  ) : null}

                  {(unterTab === 'bewertung') && bewertung.length > 0 ? (
                    <PaFundamentalMetrikTabelle
                      titel="Bewertungskennzahlen / Multiples"
                      perioden={daten.perioden}
                      zeilen={bewertung}
                      aktivIds={chartAktiv}
                      onToggleZeile={toggleChartZeile}
                    />
                  ) : null}

                  {(unterTab === 'schaetzungen') && schaetzungen.length > 0 ? (
                    <PaFundamentalMetrikTabelle
                      titel="Schätzungen (Konsens · Yahoo Finance)"
                      perioden={daten.perioden}
                      zeilen={schaetzungen}
                      aktivIds={chartAktiv}
                      onToggleZeile={toggleChartZeile}
                    />
                  ) : null}
                </div>
              ) : (
                <PaCard className="p-8 text-center text-sm text-zinc-500">
                  Dieser Bereich wird in einer späteren Version befüllt.
                </PaCard>
              )}

              <p className="text-[10px] text-zinc-600">
                Quellen: Macrotrends.net · Yahoo Finance (Schätzungen) · Stand{' '}
                {new Date(daten.geladenAm).toLocaleString('de-DE')} · Cache 24h
              </p>
            </>
          ) : null}
        </div>
      )}
    </PortfolioAnalyseShell>
  )
}
