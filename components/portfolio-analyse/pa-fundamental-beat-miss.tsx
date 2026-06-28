'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { useCallback, useEffect, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { EarningsBeatMissPaket } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'

function BeatMissBadge({ anzeige }: { anzeige: string | null }) {
  if (!anzeige) return <span className="text-[var(--app-text-muted)]">–</span>
  const beat = anzeige.startsWith('Beat')
  const miss = anzeige.startsWith('Miss')
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        beat
          ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
          : miss
            ? 'bg-red-500/15 text-red-300 ring-red-500/30'
            : 'bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)] ring-[var(--app-border-strong)]/40'
      }`}
    >
      {anzeige}
    </span>
  )
}

export function PaFundamentalBeatMiss({
  ticker,
  symbolYahoo,
  isin,
  selectionKey,
}: {
  ticker: string | null
  symbolYahoo?: string | null
  isin?: string | null
  selectionKey?: string
}) {
  const [daten, setDaten] = useState<EarningsBeatMissPaket | null>(null)
  const [laden, setLaden] = useState(false)

  const lade = useCallback(async () => {
    if (!ticker?.trim()) return
    setLaden(true)
    try {
      const res = await fetch('/api/portfolio-analyse/earnings-beat-miss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, symbolYahoo, isin, limit: 8 }),
        signal: AbortSignal.timeout(60_000),
      })
      setDaten((await res.json()) as EarningsBeatMissPaket)
    } catch {
      setDaten(null)
    } finally {
      setLaden(false)
    }
  }, [ticker, symbolYahoo, isin])

  useEffect(() => {
    setDaten(null)
    if (ticker?.trim()) void lade()
  }, [selectionKey, ticker, lade])

  if (!ticker?.trim()) return null

  return (
    <PaCard className="space-y-3 overflow-hidden p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Earnings Beat/Miss-Historie</h3>
        <p className="text-xs text-[var(--app-text-muted)]">
          Letzte 8 Quartale · EPS & Umsatz vs. Konsens
          {daten?.quelle ? ` (${daten.quelle === 'marketbeat' ? 'MarketBeat' : daten.quelle === 'finnhub' ? 'Finnhub' : 'MarketBeat + Finnhub'})` : ''}
        </p>
      </div>

      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lädt …</p> : null}

      {daten?.guidanceHinweis ? (
        <p className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-sm text-[var(--app-text)]">
          {daten.guidanceHinweis}
        </p>
      ) : null}

      {daten?.fehler && !daten.quartale.length ? (
        <p className="text-sm text-amber-200/90">{daten.fehler}</p>
      ) : null}

      {daten?.quartale.length ? (
        <div className={`${appTableScrollClassName} rounded-xl border border-[var(--app-border)]`}>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--app-surface-muted)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Quartal</th>
                <th className="px-3 py-2 font-semibold">EPS</th>
                <th className="px-3 py-2 font-semibold">EPS vs. Schätzung</th>
                <th className="px-3 py-2 font-semibold">Umsatz</th>
                <th className="px-3 py-2 font-semibold">Umsatz vs. Schätzung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {daten.quartale.map((q) => (
                <tr key={q.quartalLabel} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-white">{q.quartalLabel}</td>
                  <td className="px-3 py-2.5 text-[var(--app-text)]">
                    {q.eps.ist != null ? formatEpsUsd(q.eps.ist) : '–'}
                  </td>
                  <td className="px-3 py-2.5">
                    <BeatMissBadge anzeige={q.eps.anzeige} />
                  </td>
                  <td className="px-3 py-2.5 text-[var(--app-text)]">
                    {q.umsatz.ist != null ? formatKompaktUsd(q.umsatz.ist) : '–'}
                  </td>
                  <td className="px-3 py-2.5">
                    <BeatMissBadge anzeige={q.umsatz.anzeige} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!laden && daten && !daten.quartale.length ? (
        <p className="text-sm text-[var(--app-text-muted)]">Keine Beat/Miss-Historie verfügbar.</p>
      ) : null}
    </PaCard>
  )
}
