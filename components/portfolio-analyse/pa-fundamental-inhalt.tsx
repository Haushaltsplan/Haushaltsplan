'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PaFundamentalEarningsCall } from '@/components/portfolio-analyse/pa-fundamental-earnings-call'
import { PaFundamentalMantra } from '@/components/portfolio-analyse/pa-fundamental-mantra'
import { PaFundamentalNews } from '@/components/portfolio-analyse/pa-fundamental-news'
import { PaFundamentalUebersicht } from '@/components/portfolio-analyse/pa-fundamental-uebersicht'
import { PaFundamentalUnternehmenHeader } from '@/components/portfolio-analyse/pa-fundamental-unternehmen-header'
import { PaFundamentalMetrikChart } from '@/components/portfolio-analyse/pa-fundamental-metrik-chart'
import { PaFundamentalMetrikTabelle } from '@/components/portfolio-analyse/pa-fundamental-metrik-tabelle'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  ladeFundamentaldatenAusLocalCache,
  ladeFundamentaldatenClient,
} from '@/lib/portfolio-analyse/fundamentaldaten-client'
import { baueMantraAudit } from '@/lib/portfolio-analyse/fundamentaldaten-mantra'
import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const UNTER_TABS = [
  { id: 'uebersicht' as const, label: 'Übersicht' },
  { id: 'mantra' as const, label: 'Mantra' },
  { id: 'finanzdaten' as const, label: 'Finanzdaten' },
  { id: 'schaetzungen' as const, label: 'Schätzungen' },
  { id: 'bewertung' as const, label: 'Bewertung' },
  { id: 'earnings_call' as const, label: 'Earnings Call' },
  { id: 'news' as const, label: 'News' },
]

export function PaFundamentalInhalt({
  anfrage,
  selectionKey,
}: {
  anfrage: FundamentaldatenAnfrage | null
  selectionKey?: string
}) {
  const [unterTab, setUnterTab] = useState<(typeof UNTER_TABS)[number]['id']>('uebersicht')
  const [daten, setDaten] = useState<FundamentaldatenPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [tickerOverride, setTickerOverride] = useState('')
  const [chartAktiv, setChartAktiv] = useState<Set<string>>(new Set())
  const [labelsAnzeigen, setLabelsAnzeigen] = useState(true)

  const effektiveAnfrage = useMemo(
    () =>
      anfrage
        ? {
            ...anfrage,
            tickerOverride: tickerOverride.trim() || anfrage.tickerOverride || null,
          }
        : null,
    [anfrage, tickerOverride],
  )

  useEffect(() => {
    setUnterTab('uebersicht')
    setTickerOverride('')
  }, [selectionKey])

  useEffect(() => {
    setChartAktiv(new Set())
  }, [selectionKey, tickerOverride])

  useEffect(() => {
    if (!effektiveAnfrage) {
      setDaten(null)
      return
    }
    const cached = ladeFundamentaldatenAusLocalCache(effektiveAnfrage)
    if (cached?.ok) setDaten(cached)

    let cancelled = false
    async function run() {
      setLaden(!cached?.ok)
      setFehler(null)
      try {
        const res = await ladeFundamentaldatenClient(effektiveAnfrage!)
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
  }, [effektiveAnfrage])

  const mantraAudit = useMemo(() => {
    if (!daten?.ok) return null
    const meta = daten.mantraMeta
    if (meta && daten.zeilen.length > 0) {
      return baueMantraAudit(
        daten.sektor,
        daten.branche,
        {
          beta: meta.beta ?? undefined,
          marketCap: meta.marketCapUsd ?? undefined,
          totalDebt: meta.totalDebtUsd ?? undefined,
          totalCash: meta.totalCashUsd ?? undefined,
        },
        { perioden: daten.perioden, zeilen: daten.zeilen },
        { perioden: [], zeilen: [] },
        meta.yahooFinanz,
      )
    }
    return daten.mantra
  }, [daten])

  const toggleChartZeile = useCallback((id: string) => {
    setChartAktiv((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (!anfrage) {
    return (
      <PaCard className="p-8 text-center text-sm text-zinc-500">
        Wähle ein Unternehmen, um Fundamentaldaten anzuzeigen.
      </PaCard>
    )
  }

  const rentabilitaet = daten?.zeilen.filter((z) => z.gruppe === 'rentabilitaet') ?? []
  const margen = daten?.zeilen.filter((z) => z.gruppe === 'margen') ?? []
  const umschlag = daten?.zeilen.filter((z) => z.gruppe === 'umschlag') ?? []
  const finanzdaten = daten?.zeilen.filter((z) => z.gruppe === 'finanzdaten') ?? []
  const cashflow = daten?.zeilen.filter((z) => z.gruppe === 'cashflow') ?? []
  const bewertungLtm = daten?.zeilen.filter((z) => z.gruppe === 'bewertung_trailing') ?? []
  const bewertungNtm = daten?.zeilen.filter((z) => z.gruppe === 'bewertung_forward') ?? []
  const schaetzungen = daten?.zeilen.filter((z) => z.gruppe === 'schaetzungen') ?? []

  return (
    <div className="space-y-4">
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
            branche={unterTab === 'uebersicht' ? null : daten.branche}
            sektor={unterTab === 'uebersicht' ? null : daten.sektor}
            website={unterTab === 'uebersicht' ? null : daten.website}
            beschreibung={daten.beschreibung}
            tabs={UNTER_TABS}
            activeTab={unterTab}
            onTabChange={setUnterTab}
            kompakt={unterTab === 'uebersicht'}
          />

          {unterTab === 'uebersicht' ? (
            <PaFundamentalUebersicht
              symbolYahoo={daten.symbolYahoo}
              ticker={daten.ticker}
              firmenname={daten.firmenname}
              metriken={daten.keyMetrics}
            />
          ) : null}

          {unterTab === 'mantra' && mantraAudit ? <PaFundamentalMantra audit={mantraAudit} /> : null}

          {unterTab === 'earnings_call' ? (
            <PaFundamentalEarningsCall
              ticker={daten.ticker}
              firmenname={daten.firmenname}
              isin={anfrage.isin ?? null}
              selectionKey={selectionKey}
            />
          ) : null}

          {unterTab === 'news' ? <PaFundamentalNews artikel={daten.news} /> : null}

          {unterTab !== 'uebersicht' &&
          unterTab !== 'news' &&
          unterTab !== 'mantra' &&
          unterTab !== 'earnings_call' ? (
            <div className="space-y-4">
              <PaFundamentalMetrikChart
                perioden={daten.perioden}
                zeilen={
                  unterTab === 'bewertung'
                    ? [...bewertungLtm, ...bewertungNtm]
                    : daten.zeilen
                }
                aktivIds={chartAktiv}
                labelsAnzeigen={labelsAnzeigen}
                variant={unterTab === 'bewertung' ? 'bewertung' : 'standard'}
                onClear={() => setChartAktiv(new Set())}
                onToggleLabels={() => setLabelsAnzeigen((v) => !v)}
              />

              {unterTab === 'finanzdaten' && finanzdaten.length > 0 ? (
                <PaFundamentalMetrikTabelle
                  titel="GuV / Finanzdaten (Mio. USD)"
                  perioden={daten.perioden}
                  zeilen={finanzdaten}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                />
              ) : null}

              {unterTab === 'finanzdaten' && cashflow.length > 0 ? (
                <PaFundamentalMetrikTabelle
                  titel="Cashflow (Mio. USD)"
                  perioden={daten.perioden}
                  zeilen={cashflow}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                />
              ) : null}

              {unterTab === 'finanzdaten' && rentabilitaet.length + margen.length + umschlag.length > 0 ? (
                <PaFundamentalMetrikTabelle
                  titel="Rentabilitätskennzahlen & Margenanalyse"
                  perioden={daten.perioden}
                  zeilen={[...rentabilitaet, ...margen, ...umschlag]}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                />
              ) : null}

              {unterTab === 'bewertung' && bewertungLtm.length > 0 ? (
                <PaFundamentalMetrikTabelle
                  titel="Bewertung LTM (Trailing) · TTM = aktuell"
                  perioden={daten.perioden}
                  zeilen={bewertungLtm}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                />
              ) : null}

              {unterTab === 'bewertung' && bewertungNtm.length > 0 ? (
                <PaFundamentalMetrikTabelle
                  titel="Bewertung NTM (Forward) · NTM = aktuell"
                  perioden={daten.perioden}
                  zeilen={bewertungNtm}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                />
              ) : null}

              {unterTab === 'schaetzungen' && schaetzungen.length > 0 ? (
                <PaFundamentalMetrikTabelle
                  titel="Schätzungen (Konsens · Yahoo Finance)"
                  perioden={daten.perioden}
                  zeilen={schaetzungen}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                />
              ) : null}
            </div>
          ) : null}

          <p className="text-[10px] text-zinc-600">
            Quellen: Macrotrends.net · Yahoo Finance · Stand{' '}
            {new Date(daten.geladenAm).toLocaleString('de-DE')} · Cache 24h
          </p>
        </>
      ) : null}
    </div>
  )
}
