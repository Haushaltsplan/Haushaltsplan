'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaPortfolioHero } from '@/components/portfolio-analyse/pa-portfolio-hero'
import { PaWertpapiereListe } from '@/components/portfolio-analyse/pa-wertpapiere-liste'
import { PaBadge, PaCard, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import {
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
} from '@/lib/portfolio-analyse/berechnung'
import { anzeigeNameFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { depotwertVorBoersenbeginn } from '@/lib/portfolio-analyse/live-bewertung'
import { berechneParqetPeriodKennzahlen } from '@/lib/portfolio-analyse/parqet-period-kennzahlen'
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
  const { live, liveLaden, kursFehler, buchungen, meta, report, hatDaten, laden } =
    usePortfolioAnalyse()
  const [periodKey, setPeriodKey] = useState<PeriodPerformance['periodKey']>('MAX')

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

  const topMover = useMemo(
    () =>
      [...positionen]
        .filter((p) => p.gewinnVerlustProzent != null && p.hatLiveKurs)
        .sort((a, b) => (b.gewinnVerlustProzent ?? 0) - (a.gewinnVerlustProzent ?? 0))
        .slice(0, 6),
    [positionen],
  )

  const startDatumIso = useMemo(() => {
    if (buchungen.length === 0) return null
    return [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum ?? null
  }, [buchungen])

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

  const startDatum = startDatumIso ? formatDatumDe(startDatumIso) : null

  if (laden && !live) {
    return <p className="py-16 text-center text-sm text-zinc-500">Portfolio wird geladen …</p>
  }

  if (!hatDaten) {
    return (
      <PaCard className="p-8 text-center">
        <p className="text-sm text-zinc-400">Noch keine Portfolio-Daten.</p>
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
  const irr = report?.performance.irrAnnualizedPercent

  const gewinn = k?.gewinnVerlustEur
  const gewinnPct = k?.gewinnVerlustProzent

  return (
    <div className="space-y-5 sm:space-y-8">
      {k ? (
        <PaPortfolioHero
          positionen={positionen}
          kennzahlen={{
            depotwertEur: k.depotwertEur,
            investiertEur: k.investiertEur,
            gewinnVerlustProzent: k.gewinnVerlustProzent,
          }}
          metrics={m}
          irr={irr}
          periodKennzahlen={periodKennzahlen}
          onPeriodKeyChange={setPeriodKey}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <PaCard variant="elevated" className="p-5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-50">Kennzahlen</h2>
          {startDatum ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">seit {startDatum} · in EUR</p>
          ) : null}
          <div className="mt-4 divide-y divide-white/[0.04]">
            <PaStatRow label="Einstand (offen)" value={k ? formatEur(k.einstandOffenEur) : '—'} />
            <PaStatRow label="Netto eingezahlt" value={k ? formatEur(k.investiertEur) : '—'} />
            <PaStatRow
              label="Gewinn / Verlust"
              value={gewinn != null ? formatEur(gewinn) : '—'}
              badge={
                gewinnPct != null ? (
                  <PaBadge variant={gewinnPct >= 0 ? 'positive' : 'negative'}>
                    {formatProzent(gewinnPct)}
                  </PaBadge>
                ) : undefined
              }
            />
            <PaStatRow
              label="Dividenden (brutto)"
              value={m ? formatEur(m.totalDividendsGrossEUR) : k ? formatEur(k.dividendenEur) : '—'}
            />
            <PaStatRow
              label="Dividenden (netto)"
              value={m ? formatEur(m.totalDividendsNetEUR) : '—'}
            />
            <PaStatRow label="Steuern (gesamt)" value={m ? formatEur(m.totalTaxesEUR) : '—'} />
            <PaStatRow label="Gebühren" value={m ? formatEur(m.totalFeesEUR) : '—'} />
          </div>
          {kursFehler ? (
            <p className="mt-3 text-[11px] text-amber-500/90">Live-Kurse teilweise nicht verfügbar.</p>
          ) : null}
        </PaCard>

        <PaCard variant="elevated" className="flex flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">Letzte Aktivitäten</h2>
            <Link href="/portfolioanalyse/aktivitaeten" className="text-xs text-teal-400 hover:underline">
              Alle →
            </Link>
          </div>
          <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
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
                  <p className="truncate text-sm text-zinc-200">
                    {anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)}
                  </p>
                  <p className="text-[11px] text-zinc-500">{formatDatumDe(b.datum)}</p>
                </div>
                <div className="text-right">
                  <PaBadge variant={badgeVariant(b.typ)}>{BUCHUNGS_TYP_LABEL[b.typ]}</PaBadge>
                  <p className="mt-1 text-sm tabular-nums text-zinc-100">{formatEur(b.betragEur)}</p>
                </div>
              </li>
            )})}
          </ul>
        </PaCard>

        <PaCard variant="elevated" className="flex flex-col">
          <div className="border-b border-white/[0.04] px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">Top Mover</h2>
            <p className="text-[11px] text-zinc-500">↑ Gewinner (live)</p>
          </div>
          <ul className="max-h-80 flex-1 divide-y divide-zinc-800/50 overflow-y-auto">
            {topMover.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-zinc-500">Keine Live-Performance.</li>
            ) : (
              topMover.map((p) => {
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
                      <p className="truncate text-sm text-zinc-200">{p.anzeigeName}</p>
                      <p className="text-[11px] text-zinc-500">{formatEur(p.wertLiveEur)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 self-start sm:self-center">
                    <PaBadge variant={(p.gewinnVerlustProzent ?? 0) >= 0 ? 'positive' : 'negative'}>
                      {p.gewinnVerlustProzent != null ? formatProzent(p.gewinnVerlustProzent) : '—'}{' '}
                      {p.gewinnVerlustEur >= 0 ? '+' : ''}
                      {formatEur(p.gewinnVerlustEur)}
                    </PaBadge>
                  </div>
                </li>
              )})
            )}
          </ul>
        </PaCard>
      </div>

      <PaWertpapiereListe
        positionen={positionen}
        buchungen={buchungen}
        meta={meta}
        laden={liveLaden}
      />

      {liveLaden ? (
        <p className="text-center text-[11px] text-zinc-600">Kurse werden aktualisiert …</p>
      ) : null}
    </div>
  )
}
