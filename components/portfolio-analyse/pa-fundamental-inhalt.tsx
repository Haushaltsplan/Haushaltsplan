'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaFundamentalQuartalszahlen } from '@/components/portfolio-analyse/pa-fundamental-quartalszahlen'
import { PaFundamentalMantra } from '@/components/portfolio-analyse/pa-fundamental-mantra'
import { PaFundamentalNews } from '@/components/portfolio-analyse/pa-fundamental-news'
import { PaFundamentalUebersicht } from '@/components/portfolio-analyse/pa-fundamental-uebersicht'
import { PaFundamentalStruktur } from '@/components/portfolio-analyse/pa-fundamental-struktur'
import { PaFundamentalUnternehmenHeader } from '@/components/portfolio-analyse/pa-fundamental-unternehmen-header'
import { PaFundamentalMetrikChart } from '@/components/portfolio-analyse/pa-fundamental-metrik-chart'
import { PaFundamentalMetrikTabelle } from '@/components/portfolio-analyse/pa-fundamental-metrik-tabelle'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  downloadFundamentaldatenJson,
  downloadFundamentaldatenKennzahlenCsv,
} from '@/lib/portfolio-analyse/fundamentaldaten-export-client'
import {
  aktualisiereAlleFundamentaldaten,
  ladeFundamentaldatenAusLocalCache,
  ladeFundamentaldatenCacheZiele,
  ladeFundamentaldatenClient,
  mergenFundamentaldatenZiele,
  type AlleAktualisierenFortschritt,
} from '@/lib/portfolio-analyse/fundamentaldaten-client'
import { keyMetricNavZiel } from '@/lib/portfolio-analyse/fundamentaldaten-key-metric-nav'
import {
  FUNDAMENTAL_NTM_KEY,
  type FundamentaldatenAnfrage,
  type FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { fundamentalQuellenZeile } from '@/lib/portfolio-analyse/fundamentaldaten-quellen'
import {
  bereinigeSchaetzungsniveausInZeilen,
  periodenOhneLeereSchaetzungen,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'

const UNTER_TABS = [
  { id: 'uebersicht' as const, label: 'Übersicht' },
  { id: 'kennzahlen' as const, label: 'Kennzahlen' },
  { id: 'mantra' as const, label: 'Mantra' },
  { id: 'struktur' as const, label: 'Struktur' },
  { id: 'quartalszahlen' as const, label: 'Quartalszahlen' },
  { id: 'news' as const, label: 'News' },
]

const KENNZAHLEN_DEFAULT_ZEILEN = ['umsatz', 'fcf', 'nettogewinn'] as const

export function PaFundamentalInhalt({
  anfrage,
  selectionKey,
  alleScrapZiele,
}: {
  anfrage: FundamentaldatenAnfrage | null
  selectionKey?: string
  /** Zusätzliche Titel (Depot-Dropdown / Watchlist), mergen mit Whitelist+Cloud-Watchlist. */
  alleScrapZiele?: FundamentaldatenAnfrage[] | null
}) {
  const [unterTab, setUnterTab] = useState<(typeof UNTER_TABS)[number]['id']>('uebersicht')
  const [daten, setDaten] = useState<FundamentaldatenPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [tickerOverride, setTickerOverride] = useState('')
  const [frequenz, setFrequenz] = useState<'jahr' | 'quartal'>('jahr')
  const [chartAktiv, setChartAktiv] = useState<Set<string>>(new Set())
  const [labelsAnzeigen, setLabelsAnzeigen] = useState(true)
  const kennzahlenAutoKey = useRef<string | null>(null)

  const effektiveAnfrage = useMemo(
    () =>
      anfrage
        ? {
            ...anfrage,
            tickerOverride: tickerOverride.trim() || anfrage.tickerOverride || null,
            frequenz,
          }
        : null,
    [anfrage, tickerOverride, frequenz],
  )

  useEffect(() => {
    setUnterTab('uebersicht')
    setTickerOverride('')
    setFrequenz('jahr')
  }, [selectionKey])

  useEffect(() => {
    setChartAktiv(new Set())
    kennzahlenAutoKey.current = null
  }, [selectionKey, tickerOverride])

  useEffect(() => {
    if (!effektiveAnfrage) {
      setDaten(null)
      return
    }
    const cached = ladeFundamentaldatenAusLocalCache(effektiveAnfrage)
    if (cached?.ok) {
      setDaten(cached)
    } else {
      // Kein Cache: alten Inhalt sofort weg — verhindert „falsche Firma“ während des Ladens
      // und springt nicht von winzigem Loader zu vollem Panel (Skeleton hält die Höhe).
      setDaten(null)
    }

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

  const toggleChartZeile = useCallback((id: string) => {
    setChartAktiv((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const navigiereZuMetrik = useCallback((metricId: string) => {
    const ziel = keyMetricNavZiel(metricId)
    if (!ziel) return
    setUnterTab(ziel.tab)
    setChartAktiv(new Set([ziel.zeileId]))
    requestAnimationFrame(() => {
      document.getElementById('fundamental-metrik-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const [exportLaeuft, setExportLaeuft] = useState(false)
  const [aktualisiere, setAktualisiere] = useState(false)
  const [alleLaeuft, setAlleLaeuft] = useState(false)
  const [alleFortschritt, setAlleFortschritt] = useState<AlleAktualisierenFortschritt | null>(null)
  const alleAbortRef = useRef<AbortController | null>(null)
  const effektiveAnfrageRef = useRef(effektiveAnfrage)
  effektiveAnfrageRef.current = effektiveAnfrage

  const ladePaket = useCallback(async (ziel: FundamentaldatenAnfrage, erneuern: boolean) => {
    return ladeFundamentaldatenClient(erneuern ? { ...ziel, cacheModus: 'erneuern' } : ziel)
  }, [])

  const aktualisierePaket = useCallback(async () => {
    if (!effektiveAnfrage || aktualisiere || alleLaeuft) return
    setAktualisiere(true)
    setFehler(null)
    try {
      setDaten(await ladePaket(effektiveAnfrage, true))
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Aktualisieren fehlgeschlagen')
    } finally {
      setAktualisiere(false)
    }
  }, [effektiveAnfrage, aktualisiere, alleLaeuft, ladePaket])

  const brichAlleAb = useCallback(() => {
    alleAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    return () => {
      alleAbortRef.current?.abort()
    }
  }, [])

  const aktualisiereAllePakete = useCallback(async () => {
    if (alleLaeuft || aktualisiere) return
    const extra = alleScrapZiele ?? []
    let serverZiele: FundamentaldatenAnfrage[] = []
    try {
      serverZiele = await ladeFundamentaldatenCacheZiele()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Cache-Ziele fehlgeschlagen')
      return
    }
    const ziele = mergenFundamentaldatenZiele(serverZiele, extra, effektiveAnfrage ? [effektiveAnfrage] : [])
    if (ziele.length === 0) {
      setFehler('Keine Titel zum Aktualisieren.')
      return
    }
    const okStart = window.confirm(
      `${ziele.length} Titel neu scrapen und den Cloud-Cache überschreiben?\n\n` +
        'Whitelist, Watchlist und sichtbare Depot-Titel. Dauert oft 20–40 Minuten — die Seite kann offen bleiben.',
    )
    if (!okStart) return

    const ac = new AbortController()
    alleAbortRef.current = ac
    setAlleLaeuft(true)
    setFehler(null)
    setAlleFortschritt({ index: 0, gesamt: ziele.length, name: 'Starte …', ok: true, fehlgeschlagen: 0 })
    try {
      const res = await aktualisiereAlleFundamentaldaten(ziele, {
        signal: ac.signal,
        onFortschritt: setAlleFortschritt,
        onPaket: (ziel, paket) => {
          const aktuell = effektiveAnfrageRef.current
          const gleicheIsin =
            aktuell?.isin &&
            ziel.isin &&
            aktuell.isin.trim().toUpperCase() === ziel.isin.trim().toUpperCase()
          const gleichesSymbol =
            !gleicheIsin &&
            aktuell?.symbolYahoo &&
            ziel.symbolYahoo &&
            aktuell.symbolYahoo.trim().toUpperCase() === ziel.symbolYahoo.trim().toUpperCase()
          if ((gleicheIsin || gleichesSymbol) && (aktuell?.frequenz ?? 'jahr') === 'jahr') {
            setDaten(paket)
          }
        },
      })
      if (res.abgebrochen) {
        setAlleFortschritt((prev) =>
          prev ? { ...prev, abgebrochen: true, name: 'Abgebrochen' } : prev,
        )
      } else if (res.fehlgeschlagen > 0) {
        setFehler(`${res.ok} aktualisiert, ${res.fehlgeschlagen} fehlgeschlagen (z. B. Timeout bei EU-Titeln).`)
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setFehler(e instanceof Error ? e.message : 'Alle aktualisieren fehlgeschlagen')
      }
    } finally {
      setAlleLaeuft(false)
      alleAbortRef.current = null
    }
  }, [alleLaeuft, aktualisiere, alleScrapZiele, effektiveAnfrage])

  const starteJsonExport = useCallback(async () => {
    if (!daten?.ok || exportLaeuft) return
    setExportLaeuft(true)
    try {
      await downloadFundamentaldatenJson(daten, anfrage)
    } catch (e) {
      console.error('[fundamentaldaten-export]', e)
      window.alert(
        e instanceof Error
          ? `Export fehlgeschlagen: ${e.message}`
          : 'Export fehlgeschlagen.',
      )
    } finally {
      setExportLaeuft(false)
    }
  }, [daten, anfrage, exportLaeuft])

  const verfuegbareZeilenIds = useMemo(() => {
    const s = new Set<string>()
    for (const z of daten?.zeilen ?? []) {
      if (Object.values(z.werte).some((v) => v != null && Number.isFinite(v))) s.add(z.id)
    }
    return s
  }, [daten?.zeilen])

  useEffect(() => {
    if (unterTab !== 'kennzahlen') return
    const key = selectionKey ?? ''
    if (kennzahlenAutoKey.current === key) return
    if (chartAktiv.size > 0) {
      kennzahlenAutoKey.current = key
      return
    }
    const ids = KENNZAHLEN_DEFAULT_ZEILEN.filter((id) => verfuegbareZeilenIds.has(id))
    if (ids.length === 0) return
    kennzahlenAutoKey.current = key
    setChartAktiv(new Set(ids))
  }, [unterTab, selectionKey, verfuegbareZeilenIds, chartAktiv])

  const zeilenBereinigt = useMemo(
    () =>
      daten?.ok ? bereinigeSchaetzungsniveausInZeilen(daten.perioden, daten.zeilen) : (daten?.zeilen ?? []),
    [daten],
  )
  const periodenBereinigt = useMemo(
    () => (daten?.ok ? periodenOhneLeereSchaetzungen(daten.perioden, zeilenBereinigt) : (daten?.perioden ?? [])),
    [daten, zeilenBereinigt],
  )

  if (!anfrage) {
    return (
      <PaCard className="flex min-h-[28rem] items-center justify-center p-8 text-center text-sm text-[var(--app-text-muted)]">
        Wähle ein Unternehmen, um Fundamentaldaten anzuzeigen.
      </PaCard>
    )
  }

  const rentabilitaet = zeilenBereinigt.filter((z) => z.gruppe === 'rentabilitaet')
  const margen = zeilenBereinigt.filter((z) => z.gruppe === 'margen')
  const umschlag = zeilenBereinigt.filter((z) => z.gruppe === 'umschlag')
  const finanzdaten = zeilenBereinigt.filter((z) => z.gruppe === 'finanzdaten')
  const bilanz = zeilenBereinigt.filter((z) => z.gruppe === 'bilanz')
  const cashflow = zeilenBereinigt.filter((z) => z.gruppe === 'cashflow')
  const bewertungLtm = zeilenBereinigt.filter((z) => z.gruppe === 'bewertung_trailing')
  const bewertungForward = zeilenBereinigt.filter((z) => z.gruppe === 'bewertung_forward')
  // Neue Pakete: Forward steckt in Trailing-Zeilen (FY-Keys). Alte Caches: separate Forward-Zeilen.
  const trailingHatForward = bewertungLtm.some((z) =>
    Object.keys(z.werte).some((k) => k.startsWith('__fy') && z.werte[k] != null),
  )
  const bewertungZeilen = (trailingHatForward
    ? bewertungLtm
    : [...bewertungLtm, ...bewertungForward]
  ).map((z) => {
    if (!(FUNDAMENTAL_NTM_KEY in z.werte)) return z
    const { [FUNDAMENTAL_NTM_KEY]: _ntm, ...werte } = z.werte
    return { ...z, werte }
  })
  const bewertungPerioden =
    periodenBereinigt.filter((p) => !p.istNtm && p.iso !== FUNDAMENTAL_NTM_KEY)
  const chartIstBewertung = [...chartAktiv].some((id) => bewertungZeilen.some((z) => z.id === id))
  const kennzahlenGruppen = [
    { id: 'guv', titel: `GuV (Mio. ${daten?.waehrung ?? 'USD'})`, zeilen: finanzdaten },
    { id: 'cashflow', titel: 'Cashflow', zeilen: cashflow },
    { id: 'bilanz', titel: 'Bilanz', zeilen: bilanz },
    { id: 'rentabilitaet', titel: 'Rentabilität & Margen', zeilen: [...rentabilitaet, ...margen, ...umschlag] },
    { id: 'bewertung', titel: 'Bewertung', zeilen: bewertungZeilen },
  ]
  return (
    <div className="space-y-4">
      {laden && !daten?.ok ? (
        <div className="space-y-3" aria-busy="true" aria-label="Fundamentaldaten werden geladen">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-48 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-8 w-64 max-w-[50%] animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
            <div className="grid min-h-[320px] lg:grid-cols-[1.05fr_0.95fr]">
              <div className="flex items-center justify-center border-b border-[var(--app-border)] p-8 lg:border-b-0 lg:border-r">
                <p className="text-sm text-[var(--app-text-muted)]">Lade Kurs &amp; Kennzahlen …</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-amber-500/20" />
                    <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.05]" />
                    <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/[0.05]" />
                    <div className="h-2.5 w-3/5 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {fehler && !daten?.ok ? (
        <PaCard className="space-y-4 p-6">
          <p className="text-sm text-amber-200/90">
            {/SEC Ticker-Liste \(429\)/i.test(fehler)
              ? 'SEC.gov ist gerade rate-limitiert (429). Bitte in 1–2 Minuten erneut laden — Macrotrends/Yahoo-Daten sollten dann wieder verfügbar sein.'
              : fehler}
          </p>
          <div>
            <label className="mb-1 block text-xs text-[var(--app-text-muted)]">Macrotrends-Ticker manuell (z. B. AAPL, ASML)</label>
            <div className="flex gap-2">
              <input
                value={tickerOverride}
                onChange={(e) => setTickerOverride(e.target.value.toUpperCase())}
                placeholder="Ticker"
                className="flex-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
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
            aktionen={
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void aktualisierePaket()}
                  disabled={aktualisiere || alleLaeuft || laden}
                  className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                  title="Nur dieses Unternehmen neu scrapen und Cloud-Cache überschreiben"
                >
                  {aktualisiere ? 'Aktualisiere …' : 'Aktualisieren'}
                </button>
                {alleLaeuft ? (
                  <button
                    type="button"
                    onClick={brichAlleAb}
                    className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-200 transition hover:bg-red-500/20"
                    title="Laufenden Komplett-Scrape abbrechen"
                  >
                    Abbrechen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void aktualisiereAllePakete()}
                    disabled={aktualisiere || laden}
                    className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
                    title="Whitelist, Watchlist und Depot neu scrapen — Cache überschreiben"
                  >
                    Alle aktualisieren
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void starteJsonExport()}
                  disabled={exportLaeuft}
                  className="rounded-md border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[11px] font-medium text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
                  title="Alle Tabs: Mantra, Kennzahlen, Struktur, Quartalszahlen (+ CapAlloc/Insider/Peer/Beat-Miss/Earnings/SEC)"
                >
                  {exportLaeuft ? 'Export …' : 'Export JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadFundamentaldatenKennzahlenCsv(daten)}
                  disabled={exportLaeuft}
                  className="rounded-md border border-white/[0.08] bg-[var(--app-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)] disabled:opacity-50"
                  title="Nur Finanz-Kennzahlen-Matrix als CSV"
                >
                  CSV
                </button>
              </div>
            }
          />

          {alleFortschritt ? (
            <p className="text-[11px] text-amber-200/80" aria-live="polite">
              {alleLaeuft
                ? `Scrape ${alleFortschritt.index}/${alleFortschritt.gesamt}: ${alleFortschritt.name}`
                : alleFortschritt.abgebrochen
                  ? `Abgebrochen bei ${alleFortschritt.index}/${alleFortschritt.gesamt}`
                  : `Fertig: ${alleFortschritt.gesamt - alleFortschritt.fehlgeschlagen}/${alleFortschritt.gesamt} im Cache`}
              {alleFortschritt.fehlgeschlagen > 0 && !alleLaeuft
                ? ` · ${alleFortschritt.fehlgeschlagen} fehlgeschlagen`
                : ''}
            </p>
          ) : null}

          {unterTab === 'uebersicht' ? (
            <PaFundamentalUebersicht
              symbolYahoo={daten.symbolYahoo}
              ticker={daten.ticker}
              firmenname={daten.firmenname}
              metriken={daten.keyMetrics}
              onMetricClick={navigiereZuMetrik}
              verfuegbareZeilenIds={verfuegbareZeilenIds}
              guvQuelle={daten.guvQuelle}
              schaetzungQuelle={daten.schaetzungQuelle}
              fallbackPaketQuelle={daten.quelle}
            />
          ) : null}

          {unterTab === 'mantra' && daten.mantra ? (
            <PaFundamentalMantra audit={daten.mantra} ticker={daten.ticker} />
          ) : null}

          {unterTab === 'quartalszahlen' ? (
            <PaFundamentalQuartalszahlen
              ticker={daten.ticker}
              firmenname={daten.firmenname}
              isin={anfrage.isin ?? null}
              symbolYahoo={daten.symbolYahoo}
              selectionKey={selectionKey}
            />
          ) : null}

          {unterTab === 'struktur' ? (
            <PaFundamentalStruktur
              paket={daten}
              ticker={daten.ticker}
              symbolYahoo={daten.symbolYahoo}
              isin={anfrage.isin ?? null}
              selectionKey={selectionKey}
            />
          ) : null}

          {unterTab === 'news' ? <PaFundamentalNews artikel={daten.news} /> : null}

          {unterTab === 'kennzahlen' ? (
            <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] ring-1 ring-white/[0.03]">
              <PaFundamentalMetrikChart
                perioden={chartIstBewertung ? bewertungPerioden : periodenBereinigt}
                zeilen={chartIstBewertung ? bewertungZeilen : zeilenBereinigt}
                aktivIds={chartAktiv}
                labelsAnzeigen={labelsAnzeigen}
                variant={chartIstBewertung ? 'bewertung' : 'standard'}
                eingebettet
                werkzeugLeiste={
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
                      Periode
                    </span>
                    <div className="inline-flex rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)] p-0.5">
                      <button
                        type="button"
                        onClick={() => setFrequenz('jahr')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                          frequenz === 'jahr'
                            ? 'bg-amber-600/90 text-white'
                            : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        Jahr
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrequenz('quartal')}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                          frequenz === 'quartal'
                            ? 'bg-amber-600/90 text-white'
                            : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        Quartal
                      </button>
                    </div>
                    {laden && daten.frequenz !== frequenz ? (
                      <span className="text-[11px] text-[var(--app-text-muted)]">
                        Lade {frequenz === 'quartal' ? 'Quartals' : 'Jahres'}daten …
                      </span>
                    ) : null}
                  </div>
                }
                onClear={() => setChartAktiv(new Set())}
                onToggleSerie={toggleChartZeile}
                onToggleLabels={() => setLabelsAnzeigen((v) => !v)}
              />
              <div className="border-t border-[var(--app-border)]">
                <PaFundamentalMetrikTabelle
                  gruppen={kennzahlenGruppen}
                  perioden={frequenz === 'jahr' ? bewertungPerioden : periodenBereinigt}
                  aktivIds={chartAktiv}
                  onToggleZeile={toggleChartZeile}
                  labelModus={frequenz === 'jahr' ? 'jahr' : 'datum'}
                  eingebettet
                />
              </div>
            </div>
          ) : null}

          <p className="text-[10px] text-[var(--app-text-muted)]">
            {fundamentalQuellenZeile({
              guvQuelle: daten.guvQuelle,
              schaetzungQuelle: daten.schaetzungQuelle,
              fallbackPaketQuelle: daten.quelle,
            }) ??
              (daten.quelle === 'yahoo'
                ? 'GuV: Yahoo'
                : daten.quelle === 'marketscreener'
                  ? 'GuV: MarketScreener'
                  : 'GuV: Macrotrends')}{' '}
            · {daten.frequenz === 'quartal' ? 'Quartalsdaten' : 'Jahresdaten'} · Stand{' '}
            {new Date(daten.geladenAm).toLocaleString('de-DE')}
          </p>
        </>
      ) : null}
    </div>
  )
}
