'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaPortfolioHero } from '@/components/portfolio-analyse/pa-portfolio-hero'
import { PaWertpapiereListe } from '@/components/portfolio-analyse/pa-wertpapiere-liste'
import { PaRenditePanel } from '@/components/portfolio-analyse/pa-rendite-panel'
import { PaBadge, PaCard, PaScrollList } from '@/components/portfolio-analyse/pa-ui'
import { PaNewsTerminalTeaser } from '@/components/portfolio-analyse/pa-news-terminal-teaser'
import { PaEarningsBriefingKarte } from '@/components/portfolio-analyse/pa-earnings-briefing-karte'
import { PaAlertsInbox } from '@/components/portfolio-analyse/pa-alerts-inbox'
import { PaMonatsbriefing } from '@/components/portfolio-analyse/pa-monatsbriefing'
import { PaBenchmarkPanel } from '@/components/portfolio-analyse/pa-benchmark-panel'
import { PaKorrelationPanel } from '@/components/portfolio-analyse/pa-korrelation-panel'
import {
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
} from '@/lib/portfolio-analyse/berechnung'
import { anzeigeHandelsBuchung } from '@/lib/portfolio-analyse/parqet-handelswerte'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { depotwertVorBoersenbeginn, ladeHistorischeKurseClient } from '@/lib/portfolio-analyse/live-bewertung'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { berechneParqetPeriodKennzahlen } from '@/lib/portfolio-analyse/parqet-period-kennzahlen'
import { berechneParqetRenditeKennzahlen } from '@/lib/portfolio-analyse/parqet-rendite-kennzahlen'
import {
  bauePositionPerfMap,
  berechnePositionPerfFuerPeriode,
  topMoverUntertitel,
  type TopMoverRichtung,
} from '@/lib/portfolio-analyse/position-period-performance'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'
import { baueWertentwicklung } from '@/lib/portfolio-analyse/wertentwicklung'
import { BUCHUNGS_TYP_LABEL, type BuchungsTyp } from '@/lib/portfolio-analyse/types'
import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'

function badgeVariant(typ: BuchungsTyp): 'buy' | 'sell' | 'dividend' | 'neutral' {
  if (typ === 'kauf') return 'buy'
  if (typ === 'verkauf') return 'sell'
  if (typ === 'dividende' || typ === 'zins') return 'dividend'
  return 'neutral'
}

/** Voller Yahoo-Ticker (RMS.PA, ATD.TO) — nicht split('.')[0], sonst fallen EU-Titel aus der Matrix. */
function yahooSymbolFuerKorrelation(p: {
  isin: string | null
  symbolYahoo: string | null
}): string | null {
  const raw = (p.symbolYahoo ?? isinKenntnis(p.isin)?.symbolYahoo ?? '').trim().toUpperCase()
  return raw || null
}

export function PortfolioDashboardClient() {
  const router = useRouter()
  const { live, liveLaden, kursFehler, buchungen, meta, report, hatDaten, laden, neuLaden, sektorLaden } =
    usePortfolioAnalyse()
  const [periodKey, setPeriodKey] = useState<PeriodPerformance['periodKey']>('MAX')
  const [topMoverRichtung, setTopMoverRichtung] = useState<TopMoverRichtung>('gewinner')
  const [kursHistorie, setKursHistorie] = useState<Map<string, Map<string, number>>>(new Map())

  const k = live?.kennzahlen
  const positionen = live?.positionen ?? []

  const korrelationTicker = useMemo(() => {
    const aktien = positionen
      .filter((p) => p.assetKlasse === 'aktie' && p.stueck > 0)
      .sort((a, b) => b.gewichtProzent - a.gewichtProzent)
    return [...new Set(aktien.map(yahooSymbolFuerKorrelation).filter((t): t is string => Boolean(t)))]
  }, [positionen])

  const wertFuerPeriode = useMemo(() => {
    if (!k || buchungen.length === 0) return []
    return baueWertentwicklung(buchungen, k.depotwertEur)
  }, [buchungen, k])

  const letzteAktivitaeten = useMemo(
    () => sortiereBuchungenNeuesteZuerst(buchungen).slice(0, 8),
    [buchungen],
  )

  const startDatumIso = useMemo(() => {
    if (buchungen.length === 0) return null
    return [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum ?? null
  }, [buchungen])

  const renditeKennzahlen = useMemo(() => {
    if (!k || buchungen.length === 0) return null
    return berechneParqetRenditeKennzahlen(buchungen, k.depotwertEur, wertFuerPeriode, startDatumIso)
  }, [buchungen, k, wertFuerPeriode, startDatumIso])

  const periodKennzahlen = useMemo(() => {
    if (!k || buchungen.length === 0) {
      return berechneParqetPeriodKennzahlen(periodKey, [], [], 0, startDatumIso)
    }
    const tagesstart =
      periodKey === '1T' && live?.positionen
        ? depotwertVorBoersenbeginn(buchungen, live.positionen, heuteIso())
        : null
    return berechneParqetPeriodKennzahlen(
      periodKey,
      buchungen,
      wertFuerPeriode,
      k.depotwertEur,
      startDatumIso,
      tagesstart,
    )
  }, [buchungen, k, live?.positionen, periodKey, startDatumIso, wertFuerPeriode])

  useEffect(() => {
    if (positionen.length === 0 || periodKey === '1T' || periodKey === 'MAX') {
      setKursHistorie(new Map())
      return
    }
    let cancelled = false
    const heute = heuteIso()
    const von = berechneParqetPeriodKennzahlen(
      periodKey,
      buchungen,
      wertFuerPeriode,
      k?.depotwertEur ?? 0,
      startDatumIso,
    ).periodStartDatumIso

    const yahoo = new Set<string>()
    const stooq: string[] = []
    for (const p of positionen) {
      if (p.symbolYahoo) yahoo.add(p.symbolYahoo)
      const kn = p.isin ? isinKenntnis(p.isin) : null
      for (const s of kn?.symbolCandidates ?? []) yahoo.add(s)
      if (kn?.stooqSymbol) stooq.push(kn.stooqSymbol)
    }

    void ladeHistorischeKurseClient([...yahoo], von, heute, stooq).then((hist) => {
      if (!cancelled) setKursHistorie(hist)
    })
    return () => {
      cancelled = true
    }
  }, [positionen, periodKey, buchungen, wertFuerPeriode, k?.depotwertEur, startDatumIso])

  const positionPerfMap = useMemo(
    () => bauePositionPerfMap(positionen, periodKey, kursHistorie, startDatumIso),
    [positionen, periodKey, kursHistorie, startDatumIso],
  )

  const topMover = useMemo(() => {
    const rows = [...positionen]
      .map((p) => {
        const key = p.isin?.toUpperCase() ?? p.name
        const perf =
          positionPerfMap.get(key) ??
          berechnePositionPerfFuerPeriode(p, periodKey, kursHistorie, startDatumIso)
        return { p, perf }
      })
      .filter(({ p, perf }) => p.hatLiveKurs && perf.gewinnVerlustProzent != null)
      .filter(({ perf }) =>
        topMoverRichtung === 'gewinner'
          ? (perf.gewinnVerlustProzent ?? 0) >= 0
          : (perf.gewinnVerlustProzent ?? 0) < 0,
      )
    rows.sort((a, b) => {
      const ap = a.perf.gewinnVerlustProzent ?? 0
      const bp = b.perf.gewinnVerlustProzent ?? 0
      return topMoverRichtung === 'gewinner' ? bp - ap : ap - bp
    })
    return rows
  }, [positionen, positionPerfMap, periodKey, kursHistorie, startDatumIso, topMoverRichtung])

  const startDatum = startDatumIso ? formatDatumDe(startDatumIso) : null

  if (laden && !live) {
    return <p className="py-16 text-center text-sm text-[var(--app-text-muted)]">Portfolio wird geladen …</p>
  }

  if (!hatDaten) {
    return (
      <PaCard className="p-8 text-center">
        <p className="text-sm text-[var(--app-text-muted)]">Noch keine Portfolio-Daten.</p>
        <Link
          href="/portfolioanalyse/import"
          className="mt-4 inline-block rounded-full bg-teal-600/80 px-5 py-2 text-sm font-medium text-white hover:bg-teal-600"
        >
          Daten importieren
        </Link>
      </PaCard>
    )
  }

  const m = report?.metrics
  const irr = renditeKennzahlen?.izfProzent ?? report?.performance.irrAnnualizedPercent

  return (
    <div className="min-w-0 space-y-5 sm:space-y-8">
      {k ? (
        <PaPortfolioHero
          positionen={positionen}
          kennzahlen={{
            depotwertEur: k.depotwertEur,
            investiertEur: renditeKennzahlen?.investiertEur ?? k.investiertEur,
            gewinnVerlustProzent: k.gewinnVerlustProzent,
          }}
          metrics={m}
          irr={irr}
          periodKennzahlen={periodKennzahlen}
          onPeriodKeyChange={setPeriodKey}
          report={report}
          sektorLaden={sektorLaden}
          meta={meta}
        />
      ) : null}

      <PaNewsTerminalTeaser
        positionen={(live?.positionen ?? [])
          .filter((p) => p.assetKlasse === 'aktie' && p.stueck > 0)
          .map((p) => ({
            isin: p.isin,
            name: p.anzeigeName || p.name,
            symbolYahoo: p.symbolYahoo,
          }))}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <PaAlertsInbox />
        <PaMonatsbriefing />
      </div>

      <PaEarningsBriefingKarte />

      {korrelationTicker.length >= 2 ? <PaKorrelationPanel ticker={korrelationTicker} /> : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-3 lg:items-start">
        {renditeKennzahlen ? (
          <div className="flex min-w-0 flex-col gap-4">
            <PaRenditePanel kennzahlen={renditeKennzahlen} startDatum={startDatum} />
            <PaBenchmarkPanel startDatumIso={startDatumIso} />
            {kursFehler ? (
              <p className="text-[11px] text-amber-500/90">Live-Kurse teilweise nicht verfügbar.</p>
            ) : null}
          </div>
        ) : (
          <PaCard variant="elevated" className="min-w-0 p-5">
            <p className="text-sm text-[var(--app-text-muted)]">Rendite wird berechnet …</p>
          </PaCard>
        )}

        <PaCard
          variant="elevated"
          className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden lg:h-[min(36rem,70vh)] lg:min-h-0"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.04] px-3 py-3 sm:px-5 lg:px-5 lg:py-3.5">
            <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--app-text)]">
              Letzte Aktivitäten
            </h2>
            <Link
              href="/portfolioanalyse/aktivitaeten"
              className="shrink-0 text-xs font-medium text-teal-400/90 transition-colors hover:text-teal-300"
            >
              Alle →
            </Link>
          </div>
          <PaScrollList className="divide-y divide-[var(--app-border)]">
            {letzteAktivitaeten.map((b) => {
              const href =
                b.assetKlasse === 'aktie' && b.isin ? fundamentaldatenHref({ isin: b.isin }) : null
              return (
                <li
                  key={b.id}
                  className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-0.5 px-3 py-3 sm:px-4 ${
                    href ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                  }`}
                  onClick={href ? () => router.push(href) : undefined}
                >
                  <div className="row-span-2 self-center">
                    <PortfolioIsinLogo
                      isin={b.isin}
                      fallbackName={b.wertpapierName}
                      meta={meta}
                      groesse="sm"
                    />
                  </div>
                  <p className="min-w-0 truncate text-sm text-[var(--app-text)]">
                    {anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)}
                  </p>
                  <p className="shrink-0 self-start text-right text-sm font-medium tabular-nums text-[var(--app-text)]">
                    {formatEur(anzeigeHandelsBuchung(b).betragEur)}
                  </p>
                  <p className="min-w-0 truncate text-[11px] text-[var(--app-text-muted)]">
                    {formatDatumDe(b.datum)}
                  </p>
                  <div className="shrink-0 justify-self-end">
                    <PaBadge variant={badgeVariant(b.typ)}>{BUCHUNGS_TYP_LABEL[b.typ]}</PaBadge>
                  </div>
                </li>
              )
            })}
          </PaScrollList>
        </PaCard>

        <PaCard
          variant="elevated"
          className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden lg:h-[min(36rem,70vh)] lg:min-h-0"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.04] px-3 py-3 sm:px-5 lg:px-5 lg:py-3.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">Top Mover</h2>
              <button
                type="button"
                onClick={() =>
                  setTopMoverRichtung((r) => (r === 'gewinner' ? 'verlierer' : 'gewinner'))
                }
                className="mt-0.5 flex max-w-full items-center gap-1 rounded-md text-[11px] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                aria-label={
                  topMoverRichtung === 'gewinner'
                    ? 'Nach größten Verlierern sortieren'
                    : 'Nach größten Gewinnern sortieren'
                }
                title="Gewinner / Verlierer umschalten"
              >
                <span className="text-sm leading-none" aria-hidden>
                  {topMoverRichtung === 'gewinner' ? '↑' : '↓'}
                </span>
                <span className="truncate">{topMoverUntertitel(periodKey, topMoverRichtung)}</span>
              </button>
            </div>
          </div>
          <PaScrollList className="divide-y divide-[var(--app-border)]">
            {topMover.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-[var(--app-text-muted)] sm:px-5">
                {topMoverRichtung === 'verlierer'
                  ? 'Keine Verlierer in diesem Zeitraum.'
                  : 'Keine Live-Performance.'}
              </li>
            ) : (
              topMover.map(({ p, perf }) => {
                const fundamentalHref =
                  p.assetKlasse === 'aktie' && p.isin
                    ? fundamentaldatenHref({ isin: p.isin })
                    : null
                const positiv = (perf.gewinnVerlustProzent ?? 0) >= 0
                return (
                  <li
                    key={p.isin ?? p.name}
                    className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-3 sm:px-4 ${
                      fundamentalHref ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                    }`}
                    onClick={
                      fundamentalHref ? () => router.push(fundamentalHref) : undefined
                    }
                    onKeyDown={
                      fundamentalHref
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              router.push(fundamentalHref)
                            }
                          }
                        : undefined
                    }
                    tabIndex={fundamentalHref ? 0 : undefined}
                    role={fundamentalHref ? 'link' : undefined}
                    aria-label={
                      fundamentalHref ? `${p.anzeigeName} — Fundamentaldaten` : undefined
                    }
                  >
                    <PortfolioIsinLogo
                      isin={p.isin}
                      fallbackName={p.name}
                      meta={meta}
                      groesse="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--app-text)]">{p.anzeigeName}</p>
                      <p className="text-[11px] tabular-nums text-[var(--app-text-muted)]">
                        {formatEur(p.wertLiveEur)}
                      </p>
                    </div>
                    <div className="min-w-0 shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          positiv ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {perf.gewinnVerlustProzent != null
                          ? formatProzent(perf.gewinnVerlustProzent)
                          : '—'}
                      </p>
                      <p
                        className={`text-[11px] tabular-nums ${
                          positiv ? 'text-emerald-400/90' : 'text-rose-400/90'
                        }`}
                      >
                        {perf.gewinnVerlustEur >= 0 ? '+' : ''}
                        {formatEur(perf.gewinnVerlustEur)}
                      </p>
                    </div>
                  </li>
                )
              })
            )}
          </PaScrollList>
        </PaCard>
      </div>

      <PaWertpapiereListe
        positionen={positionen}
        buchungen={buchungen}
        meta={meta}
        laden={liveLaden}
        periodKey={periodKey}
        positionPerfMap={positionPerfMap}
        onVerkaufGebucht={neuLaden}
      />

      {liveLaden ? (
        <p className="text-center text-[11px] text-[var(--app-text-muted)]">Kurse werden aktualisiert …</p>
      ) : null}
    </div>
  )
}
