'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { EarningsBriefingEintrag, EarningsBriefingErgebnis } from '@/lib/portfolio-analyse/earnings-briefing-types'

function guidanceBadge(r: EarningsBriefingEintrag['guidanceRichtung']) {
  if (r === 'up') return <PaBadge variant="positive">Guidance ↑</PaBadge>
  if (r === 'down') return <PaBadge variant="negative">Guidance ↓</PaBadge>
  if (r === 'inline') return <PaBadge variant="neutral">Guidance ≈</PaBadge>
  return null
}

function revisionBadge(r: EarningsBriefingEintrag['revisionMeta']['revisionsRichtung']) {
  if (r === 'up') return <PaBadge variant="positive">Rev. ↑</PaBadge>
  if (r === 'down') return <PaBadge variant="negative">Rev. ↓</PaBadge>
  if (r === 'flat') return <PaBadge variant="neutral">Rev. →</PaBadge>
  return null
}

export function PaEarningsBriefingKarte() {
  const { live, hatDaten } = usePortfolioAnalyse()
  const [daten, setDaten] = useState<EarningsBriefingErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const positionen = useMemo(
    () =>
      (live?.positionen ?? [])
        .filter((p) => p.stueck > 0 && p.assetKlasse === 'aktie')
        .map((p) => {
          const isin = p.isin?.trim().toUpperCase() || null
          const k = isin ? isinKenntnis(isin) : undefined
          return {
            isin,
            name: p.name ?? k?.name ?? 'Wertpapier',
            stueck: p.stueck,
            symbolYahoo: p.symbolYahoo ?? k?.symbolYahoo ?? null,
            symbolCandidates: k?.symbolCandidates,
          }
        }),
    [live?.positionen],
  )

  useEffect(() => {
    if (!hatDaten || positionen.length === 0) {
      setDaten(null)
      return
    }
    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      try {
        const res = await fetch('/api/portfolio-analyse/earnings/briefing-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positionen, horizonTage: 7 }),
        })
        const j = (await res.json()) as EarningsBriefingErgebnis & { ok?: boolean; message?: string }
        if (cancelled) return
        if (!res.ok || j.ok === false) {
          setFehler(j.message ?? 'Briefing fehlgeschlagen.')
          setDaten(null)
          return
        }
        setDaten(j)
      } catch (e) {
        if (!cancelled) {
          setFehler(e instanceof Error ? e.message : 'Briefing fehlgeschlagen.')
          setDaten(null)
        }
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [hatDaten, positionen])

  if (!hatDaten) return null

  const heute = daten?.eintraege.filter((e) => e.tageBis === 0) ?? []
  const woche = daten?.eintraege.filter((e) => e.tageBis > 0) ?? []

  return (
    <PaCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
            Earnings-Briefing
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
            Heute / nächste 7 Tage · Konsens, Revisionen, Beat-Rate
          </p>
        </div>
        <Link
          href="/portfolioanalyse/earnings"
          className="text-[11px] text-teal-400/90 hover:text-teal-300"
        >
          Kalender →
        </Link>
      </div>

      {laden && !daten ? (
        <p className="mt-4 text-sm text-[var(--app-text-muted)]">Lade Briefing…</p>
      ) : null}
      {fehler ? <p className="mt-4 text-sm text-rose-300">{fehler}</p> : null}

      {!laden && daten && daten.eintraege.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--app-text-muted)]">
          Keine Earnings im Depot in den nächsten 7 Tagen.
        </p>
      ) : null}

      {heute.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-amber-300/90">
            Heute
          </p>
          <ul className="space-y-3">{heute.map((e) => <BriefingZeile key={`${e.symbol}-${e.terminDatumIso}`} e={e} />)}</ul>
        </div>
      ) : null}

      {woche.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
            Diese Woche
          </p>
          <ul className="space-y-3">{woche.map((e) => <BriefingZeile key={`${e.symbol}-${e.terminDatumIso}`} e={e} />)}</ul>
        </div>
      ) : null}
    </PaCard>
  )
}

function BriefingZeile({ e }: { e: EarningsBriefingEintrag }) {
  const href = fundamentaldatenHref({
    isin: e.isin,
    symbol: e.symbol,
    name: e.name,
  })
  return (
    <li className="rounded-lg border border-[var(--app-border)]/60 bg-[var(--app-surface-muted)]/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} className="text-sm font-medium text-[var(--app-text)] hover:text-teal-300">
          {e.name}
          {e.symbol ? <span className="ml-1.5 text-[11px] text-[var(--app-text-muted)]">{e.symbol}</span> : null}
        </Link>
        <span className="text-[11px] tabular-nums text-[var(--app-text-muted)]">
          {e.terminDatumIso}
          {e.tageBis > 0 ? ` · in ${e.tageBis}d` : ''}
        </span>
        {e.berichtszeitAnzeige ? <PaBadge variant="neutral">{e.berichtszeitAnzeige}</PaBadge> : null}
        {revisionBadge(e.revisionMeta.revisionsRichtung)}
        {guidanceBadge(e.guidanceRichtung)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--app-text-muted)]">
        <span>
          EPS{' '}
          <span className="tabular-nums text-[var(--app-text)]">
            {e.eps.averageAnzeige ?? (e.eps.average != null ? e.eps.average.toFixed(2) : '–')}
          </span>
          {e.eps.low != null && e.eps.high != null ? (
            <span className="ml-1 tabular-nums opacity-70">
              ({e.eps.low.toFixed(2)}–{e.eps.high.toFixed(2)})
            </span>
          ) : null}
        </span>
        <span>
          Umsatz{' '}
          <span className="tabular-nums text-[var(--app-text)]">{e.umsatz.averageAnzeige ?? '–'}</span>
        </span>
        {e.epsBeatRatePct != null ? (
          <span>
            Beat-Rate{' '}
            <span className="tabular-nums text-[var(--app-text)]">
              {e.epsBeatRatePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })}%
            </span>
          </span>
        ) : null}
        {e.revisionMeta.epsAnalysten != null ? (
          <span className="tabular-nums">{e.revisionMeta.epsAnalysten} Analysten</span>
        ) : null}
      </div>
      {e.letzterCallKiKurz ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
          {e.letzterCallKiKurz}
        </p>
      ) : null}
    </li>
  )
}
