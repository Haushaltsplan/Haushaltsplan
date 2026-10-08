'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaAktienSucheInput } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  berechnePersoenlicheDivRenditeProzent,
  dividendenTtmJeIsin,
} from '@/lib/portfolio-analyse/dividenden-yoc'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  TITEL_VERGLEICH_ZEILEN,
  type TitelVergleichKennzahlId,
  type TitelVergleichPaket,
  type TitelVergleichSpalte,
  type TitelVergleichZeileDef,
} from '@/lib/portfolio-analyse/titel-vergleich-types'
import {
  entferneAusTitelVergleich,
  fuegeZumTitelVergleichHinzu,
  ladeTitelVergleich,
  leereTitelVergleich,
  setzeTitelVergleichReferenz,
  TITEL_VERGLEICH_CHANGED_EVENT,
  TITEL_VERGLEICH_MAX,
  titelVergleichSchluessel,
  type TitelVergleichEintrag,
  type TitelVergleichState,
} from '@/lib/portfolio-analyse/titel-vergleich-store'

function fmtWert(v: number | null | undefined, format: TitelVergleichZeileDef['format']): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (format === 'pct') {
    return `${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
  }
  if (format === 'mult') {
    return `${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}×`
  }
  return v.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

function vsFarbe(
  wert: number | null | undefined,
  ref: number | null | undefined,
  higherIsBetter: boolean | null,
  istReferenz: boolean,
): string {
  if (istReferenz || higherIsBetter == null || wert == null || ref == null) {
    return 'text-[var(--app-text)]'
  }
  if (wert === ref) return 'text-[var(--app-text)]'
  const besser = higherIsBetter ? wert > ref : wert < ref
  return besser ? 'text-emerald-300' : 'text-rose-300'
}

export function PortfolioTitelVergleichClient() {
  const { live, buchungen, meta } = usePortfolioAnalyse()
  const [state, setState] = useState<TitelVergleichState>({ eintraege: [], referenzKey: null })
  const [paket, setPaket] = useState<TitelVergleichPaket | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const syncLocal = useCallback(() => {
    setState(ladeTitelVergleich())
  }, [])

  useEffect(() => {
    syncLocal()
    const on = () => syncLocal()
    window.addEventListener(TITEL_VERGLEICH_CHANGED_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(TITEL_VERGLEICH_CHANGED_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [syncLocal])

  const ttmMap = useMemo(() => dividendenTtmJeIsin(buchungen), [buchungen])

  useEffect(() => {
    if (state.eintraege.length === 0) {
      setPaket(null)
      return
    }
    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      try {
        const res = await fetch('/api/portfolio-analyse/titel-vergleich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titel: state.eintraege.map((e) => ({
              isin: e.isin,
              symbolYahoo: e.symbolYahoo,
              name: e.name,
            })),
          }),
          signal: AbortSignal.timeout(120_000),
        })
        const j = (await res.json()) as TitelVergleichPaket
        if (!cancelled) setPaket(j)
      } catch (e) {
        if (!cancelled) {
          setPaket(null)
          setFehler(e instanceof Error ? e.message : 'Vergleich fehlgeschlagen')
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [state.eintraege])

  const spaltenMitYoC: TitelVergleichSpalte[] = useMemo(() => {
    const roh = paket?.spalten ?? []
    return roh.map((s) => {
      const isin = s.isin?.toUpperCase() ?? null
      const pos = live?.positionen.find((p) => p.isin?.toUpperCase() === isin)
      if (!pos || pos.stueck <= 0) return s
      const yieldPct = s.werte.div_yield ?? null
      const pers = berechnePersoenlicheDivRenditeProzent({
        einstandEur: pos.einstandEur,
        stueck: pos.stueck,
        kursLiveEur: pos.kursLiveEur ?? pos.kursEur,
        dividendYieldPct: yieldPct,
        ttmDividendenEur: isin ? ttmMap.get(isin) ?? null : null,
      })
      return {
        ...s,
        werte: { ...s.werte, pers_div_yield: pers },
      }
    })
  }, [paket, live?.positionen, ttmMap])

  const referenzSpalte = useMemo(() => {
    if (!state.referenzKey) return spaltenMitYoC[0] ?? null
    return (
      spaltenMitYoC.find((s) => {
        const e = state.eintraege.find((x) => titelVergleichSchluessel(x) === state.referenzKey)
        if (!e) return false
        return s.key === state.referenzKey || s.isin === e.isin || s.symbolYahoo === e.symbolYahoo
      }) ??
      spaltenMitYoC[0] ??
      null
    )
  }, [spaltenMitYoC, state.referenzKey, state.eintraege])

  const zeilen = paket?.zeilen?.length ? paket.zeilen : TITEL_VERGLEICH_ZEILEN
  const gruppen = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, TitelVergleichZeileDef[]>()
    for (const z of zeilen) {
      if (!map.has(z.gruppe)) {
        order.push(z.gruppe)
        map.set(z.gruppe, [])
      }
      map.get(z.gruppe)!.push(z)
    }
    return order.map((g) => ({ gruppe: g, zeilen: map.get(g)! }))
  }, [zeilen])

  function hinzufuegen(eintrag: TitelVergleichEintrag) {
    const r = fuegeZumTitelVergleichHinzu(eintrag)
    if (!r.ok) setFehler(r.fehler ?? 'Hinzufügen fehlgeschlagen')
    else setFehler(null)
    setState(r.state)
  }

  const leerMeta = useMemo(() => new Map<string, IsinMetadata>(), [])
  const metaMap = meta.size > 0 ? meta : leerMeta

  return (
    <PortfolioAnalyseShell title="Titelvergleich" ohneDepotErlaubt>
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">
              Titelvergleich ({state.eintraege.length})
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
              Bis {TITEL_VERGLEICH_MAX} Unternehmen Side-by-Side · Fundamentaldaten &amp; pers. Div-Rendite
            </p>
          </div>
          {state.eintraege.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                leereTitelVergleich()
                setState(ladeTitelVergleich())
                setPaket(null)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[var(--app-text-muted)] transition hover:border-rose-400/30 hover:text-rose-300"
            >
              Vergleich leeren
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-teal-100/90 sm:px-4">
          Klicke auf den Stern, um einen Titel als Referenz zu setzen. Alle anderen werden damit
          verglichen (besser = teal, schlechter = rot).
        </div>

        <div className="max-w-xl">
          <PaAktienSucheInput
            kompakt
            nurSuche
            placeholder="Titel zum Vergleich hinzufügen…"
            onFehler={setFehler}
            onAuswahl={({ meta: m, isin }) => {
              hinzufuegen({
                isin,
                name: m.name,
                symbolYahoo: m.symbolYahoo,
              })
            }}
          />
          {fehler ? <p className="mt-1.5 text-[11px] text-amber-400/90">{fehler}</p> : null}
        </div>

        {state.eintraege.length === 0 ? (
          <PaCard className="p-8 text-center text-sm text-[var(--app-text-muted)]">
            Noch keine Titel. Suche oben oder nutze „Zum Vergleich“ in den Fundamentaldaten.
          </PaCard>
        ) : (
          <>
            <p className="hidden text-[11px] text-[var(--app-text-muted)] lg:block">
              Tipp: Shift + Mausrad oder Trackpad seitlich, um die Tabelle zu verschieben.
            </p>

            {/* Mobile: gestapelte Karten — kein Shop-Grid */}
            <div className="space-y-3 lg:hidden">
              {state.eintraege.map((e) => {
                const key = titelVergleichSchluessel(e)
                const sp =
                  spaltenMitYoC.find(
                    (s) =>
                      s.key === key ||
                      (e.isin && s.isin === e.isin) ||
                      (e.symbolYahoo && s.symbolYahoo === e.symbolYahoo),
                  ) ?? null
                const istRef = state.referenzKey === key
                return (
                  <PaCard key={key} className="p-4">
                    <div className="flex items-start gap-3">
                      <PortfolioIsinLogo
                        isin={e.isin}
                        fallbackName={e.name}
                        meta={metaMap}
                        groesse="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--app-text)]">{e.name}</p>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          {e.symbolYahoo ?? e.isin ?? '—'}
                          {istRef ? ' · Referenz' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Referenz"
                        onClick={() => setState(setzeTitelVergleichReferenz(key))}
                        className={`text-lg ${istRef ? 'text-amber-300' : 'text-[var(--app-text-muted)]'}`}
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        aria-label="Entfernen"
                        onClick={() => setState(entferneAusTitelVergleich(key))}
                        className="text-[var(--app-text-muted)] hover:text-rose-300"
                      >
                        ×
                      </button>
                    </div>
                    {laden && !sp ? (
                      <p className="mt-3 text-xs text-[var(--app-text-muted)]">Lade …</p>
                    ) : (
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        {zeilen.slice(0, 6).map((z) => (
                          <div key={z.id} className="contents">
                            <dt className="text-[var(--app-text-muted)]">{z.label}</dt>
                            <dd className="text-right tabular-nums text-[var(--app-text)]">
                              {fmtWert(sp?.werte[z.id as TitelVergleichKennzahlId], z.format)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <Link
                      href={fundamentaldatenHref({
                        isin: e.isin,
                        symbol: e.symbolYahoo,
                        name: e.name,
                      })}
                      className="mt-3 inline-flex text-xs font-medium text-teal-400 hover:underline"
                    >
                      Zur Analyse →
                    </Link>
                  </PaCard>
                )
              })}
            </div>

            {/* Web: Shop-artiges Vergleichsgrid */}
            <div
              className="hidden overflow-x-auto lg:block"
              data-no-swipe-nav
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div
                className="inline-grid min-w-full border border-white/[0.06] bg-[var(--app-surface)]"
                style={{
                  gridTemplateColumns: `minmax(11rem,14rem) repeat(${Math.max(state.eintraege.length, 1)}, minmax(14rem, 18rem))`,
                }}
              >
                {/* Header row */}
                <div className="sticky left-0 z-20 border-b border-r border-white/[0.06] bg-[var(--app-surface)]" />
                {state.eintraege.map((e) => {
                  const key = titelVergleichSchluessel(e)
                  const istRef = state.referenzKey === key
                  return (
                    <div
                      key={`h-${key}`}
                      className={`relative border-b border-r border-white/[0.06] px-4 py-4 last:border-r-0 ${
                        istRef ? 'bg-teal-500/[0.04]' : 'bg-[var(--app-surface)]'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          title="Als Referenz setzen"
                          aria-label="Als Referenz setzen"
                          onClick={() => setState(setzeTitelVergleichReferenz(key))}
                          className={`text-xl leading-none transition ${
                            istRef ? 'text-amber-300' : 'text-white/25 hover:text-amber-200/80'
                          }`}
                        >
                          ★
                        </button>
                        <button
                          type="button"
                          aria-label="Aus Vergleich entfernen"
                          onClick={() => setState(entferneAusTitelVergleich(key))}
                          className="rounded-md px-1.5 text-lg leading-none text-[var(--app-text-muted)] hover:bg-white/[0.05] hover:text-rose-300"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex flex-col items-center gap-3 text-center">
                        <PortfolioIsinLogo
                          isin={e.isin}
                          fallbackName={e.name}
                          meta={metaMap}
                          groesse="md"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-[var(--app-text)]">
                            {e.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[var(--app-text-muted)]">
                            {e.symbolYahoo ?? e.isin ?? '—'}
                          </p>
                        </div>
                        <Link
                          href={fundamentaldatenHref({
                            isin: e.isin,
                            symbol: e.symbolYahoo,
                            name: e.name,
                          })}
                          className="inline-flex rounded-full bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-teal-950/40 transition hover:bg-teal-500"
                        >
                          Zur Analyse
                        </Link>
                      </div>
                    </div>
                  )
                })}

                {laden && spaltenMitYoC.length === 0 ? (
                  <div className="col-span-full px-4 py-10 text-center text-sm text-[var(--app-text-muted)]">
                    Fundamentaldaten werden geladen …
                  </div>
                ) : null}

                {gruppen.map(({ gruppe, zeilen: gz }) => (
                  <div key={gruppe} className="contents">
                    <div className="sticky left-0 z-10 border-b border-r border-white/[0.06] bg-[var(--app-surface-muted)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/90">
                      {gruppe}
                    </div>
                    {state.eintraege.map((e) => (
                      <div
                        key={`g-${gruppe}-${titelVergleichSchluessel(e)}`}
                        className="border-b border-r border-white/[0.06] bg-[var(--app-surface-muted)] last:border-r-0"
                      />
                    ))}
                    {gz.map((z, zi) => {
                      const zebra = zi % 2 === 0
                      return (
                        <div key={z.id} className="contents">
                          <div
                            className={`sticky left-0 z-10 border-b border-r border-white/[0.06] px-3 py-2.5 text-[13px] text-[var(--app-text)] ${
                              zebra ? 'bg-[var(--app-surface)]' : 'bg-white/[0.02]'
                            }`}
                          >
                            {z.label}
                          </div>
                          {state.eintraege.map((e) => {
                            const key = titelVergleichSchluessel(e)
                            const sp =
                              spaltenMitYoC.find(
                                (s) =>
                                  s.key === key ||
                                  (e.isin && s.isin === e.isin) ||
                                  (e.symbolYahoo && s.symbolYahoo === e.symbolYahoo),
                              ) ?? null
                            const istRef = state.referenzKey === key
                            const wert = sp?.werte[z.id]
                            const refWert = referenzSpalte?.werte[z.id]
                            return (
                              <div
                                key={`${z.id}-${key}`}
                                className={`border-b border-r border-white/[0.06] px-3 py-2.5 text-right text-[13px] font-medium tabular-nums last:border-r-0 ${
                                  zebra ? 'bg-[var(--app-surface)]' : 'bg-white/[0.02]'
                                } ${istRef ? 'bg-teal-500/[0.03]' : ''} ${vsFarbe(
                                  wert,
                                  refWert,
                                  z.higherIsBetter,
                                  istRef,
                                )}`}
                              >
                                {fmtWert(wert, z.format)}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </PortfolioAnalyseShell>
  )
}
