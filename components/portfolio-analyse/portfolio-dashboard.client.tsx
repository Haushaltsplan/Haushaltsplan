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
import { PaKorrelationPanel } from '@/components/portfolio-analyse/pa-korrelation-panel'
import {
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
} from '@/lib/portfolio-analyse/berechnung'
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

export function PortfolioDashboardClient() {
  const router = useRouter()
  const { live, liveLaden, kursFehler, buchungen, meta, report, hatDaten, laden, neuLaden, sektorLaden } =
    usePortfolioAnalyse()
  const [periodKey, setPeriodKey] = useState<PeriodPerformance['periodKey']>('MAX')
  const [kursHistorie, setKursHistorie] = useState<Map<string, Map<string, number>>>(new Map())

  const k = live?.kennzahlen
  const positionen = live?.positionen ?? []

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

  const topMover = useMemo(
    () =>
      [...positionen]
        .map((p) => {
          const key = p.isin?.toUpperCase() ?? p.name
          const perf = positionPerfMap.get(key) ?? berechnePositionPerfFuerPeriode(p, periodKey, kursHistorie, startDatumIso)
          return { p, perf }
        })
        .filter(({ p, perf }) => p.hatLiveKurs && perf.gewinnVerlustProzent != null)
        .sort((a, b) => (b.perf.gewinnVerlustProzent ?? 0) - (a.perf.gewinnVerlustProzent ?? 0))
        .slice(0, 6),
    [positionen, positionPerfMap, periodKey, kursHistorie, startDatumIso],
  )

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
    <div className="space-y-5 sm:space-y-8">
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

      {(() => {
        const aktien = (live?.positionen ?? [])
          .filter((p) => p.assetKlasse === 'aktie' && p.stueck > 0 && p.symbolYahoo)
          .sort((a, b) => b.gewichtProzent - a.gewichtProzent)
          .slice(0, 14)
        const ticker = aktien
          .map((p) => p.symbolYahoo!.split('.')[0]!.toUpperCase())
          .filter(Boolean)
        if (ticker.length < 2) return null
        return <PaKorrelationPanel ticker={ticker} />
      })()}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {renditeKennzahlen ? (
          <div className="min-h-0">
            <PaRenditePanel kennzahlen={renditeKennzahlen} startDatum={startDatum} />
            {kursFehler ? (
              <p className="mt-2 text-[11px] text-amber-500/90">Live-Kurse teilweise nicht verfügbar.</p>
            ) : null}
          </div>
        ) : (
          <PaCard variant="elevated" className="p-5">
            <p className="text-sm text-[var(--app-text-muted)]">Rendite wird berechnet …</p>
          </PaCard>
        )}

        <PaCard variant="elevated" className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.04] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Letzte Aktivitäten</h2>
            <Link href="/portfolioanalyse/aktivitaeten" className="text-xs text-teal-400 hover:underline">
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
                className={`flex items-center gap-3 px-4 py-3 ${href ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
                onClick={href ? () => router.push(href) : undefined}
              >
                <PortfolioIsinLogo isin={b.isin} fallbackName={b.wertpapierName} meta={meta} groesse="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--app-text)]">
                    {anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)}
                  </p>
                  <p className="text-[11px] text-[var(--app-text-muted)]">{formatDatumDe(b.datum)}</p>
                </div>
                <div className="text-right">
                  <PaBadge variant={badgeVariant(b.typ)}>{BUCHUNGS_TYP_LABEL[b.typ]}</PaBadge>
                  <p className="mt-1 text-sm tabular-nums text-[var(--app-text)]">{formatEur(b.betragEur)}</p>
                </div>
              </li>
            )})}
          </PaScrollList>
        </PaCard>

        <PaCard variant="elevated" className="flex min-h-0 flex-col">
          <div className="shrink-0 border-b border-white/[0.04] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Top Mover</h2>
            <p className="text-[11px] text-[var(--app-text-muted)]">{topMoverUntertitel(periodKey)}</p>
          </div>
          <PaScrollList className="divide-y divide-[var(--app-border)]">
            {topMover.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-[var(--app-text-muted)]">Keine Live-Performance.</li>
            ) : (
              topMover.map(({ p, perf }) => {
                const fundamentalHref =
                  p.assetKlasse === 'aktie' && p.isin ? fundamentaldatenHref({ isin: p.isin }) : null
                return (
                <li
                  key={p.isin ?? p.name}
                  className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${fundamentalHref ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
                  onClick={fundamentalHref ? () => router.push(fundamentalHref) : undefined}
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
                  aria-label={fundamentalHref ? `${p.anzeigeName} — Fundamentaldaten` : undefined}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--app-text)]">{p.anzeigeName}</p>
                      <p className="text-[11px] text-[var(--app-text-muted)]">{formatEur(p.wertLiveEur)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 self-start sm:self-center">
                    <PaBadge variant={(perf.gewinnVerlustProzent ?? 0) >= 0 ? 'positive' : 'negative'}>
                      {perf.gewinnVerlustProzent != null ? formatProzent(perf.gewinnVerlustProzent) : '—'}{' '}
                      {perf.gewinnVerlustEur >= 0 ? '+' : ''}
                      {formatEur(perf.gewinnVerlustEur)}
                    </PaBadge>
                  </div>
                </li>
              )})
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
